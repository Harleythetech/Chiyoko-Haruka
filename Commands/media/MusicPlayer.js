const path = require('path');
const fs = require('fs');
const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder} = require('discord.js');
const {bug, failedtoplay, notoncall, left} = require('../../handlers/embed.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, StreamType} = require('@discordjs/voice');
const {BOT_VERSION} = require('../../handlers/config.json');
const ytdl = require('@distube/ytdl-core');
const ytpl = require('@distube/ytpl');
const { mixHandler, handleYouTubeMix } = require(path.join(__dirname, 'modules', 'YouTubeMixIntegration'));
const VideoInfoExtractor = require(path.join(__dirname, 'modules', 'VideoInfoExtractor'));

// Retry helper function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Check if it's a rate limit or robot detection error
            const errorMessage = error?.message || error?.toString() || '';
            const isRetryableError = errorMessage.includes('429') || 
                                   errorMessage.includes('robot') ||
                                   errorMessage.includes('captcha') ||
                                   errorMessage.includes('rate limit');
            
            if (!isRetryableError) {
                throw error;
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

class MusicManager {
    constructor() {
        this.players = new Map();
        this.currentlyPlaying = new Map();
        this.videoExtractor = new VideoInfoExtractor();
    }
    
    // Helper function to get HD thumbnail from YouTube URL
    getHDThumbnail(url, fallbackThumbnail = null) {
        try {
            // Extract video ID from URL
            const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
            
            if (videoIdMatch && videoIdMatch[1]) {
                const videoId = videoIdMatch[1];
                // Use maxresdefault for highest quality, fallback to hqdefault if not available
                return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            }
            
            // If we can't extract video ID, use the fallback
            return fallbackThumbnail || `https://img.youtube.com/vi/default/hqdefault.jpg`;
        } catch (error) {
            return fallbackThumbnail || `https://img.youtube.com/vi/default/hqdefault.jpg`;
        }
    }

    // Helper function to extract video ID from YouTube URL for web GUI
    extractVideoId(url) {
        try {
            const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
            if (videoIdMatch && videoIdMatch[1]) {
                return videoIdMatch[1];
            }
            return null;
        } catch (error) {
            return null;
        }
    }
    
    // Get all currently playing music across servers
    getAllCurrentlyPlaying() {
        const result = [];
        for (const [guildId, songData] of this.currentlyPlaying) {
            result.push({
                guildId,
                ...songData
            });
        }
        return result;
    }
    
    // Get music data for web dashboard
    getWebDashboardData() {
        const playingMusic = this.getAllCurrentlyPlaying();
        const activePlayerCount = this.players.size;
        
        const enhancedSongs = playingMusic.map(song => {
            const player = this.players.get(song.guildId);
            const currentTime = Date.now();
            let elapsedSeconds = 0;
            
            if (song.startTime) {
                if (song.isPaused && song.pausedAt) {
                    elapsedSeconds = Math.floor((song.pausedAt - song.startTime) / 1000);
                } else {
                    elapsedSeconds = Math.floor((currentTime - song.startTime) / 1000);
                }
            }
            
            return {
                ...song,
                queueLength: player ? player.queue.length : 0,
                playerStatus: player ? player.audioPlayer.state.status : 'idle',
                elapsedSeconds: Math.max(0, elapsedSeconds),
                progressPercent: song.duration > 0 ? Math.min((elapsedSeconds / song.duration) * 100, 100) : 0,
                // Extract video ID for web GUI thumbnail
                image: this.extractVideoId(song.url)
            };
        });
        
        return {
            hasActiveMusic: playingMusic.length > 0,
            activePlayersCount: activePlayerCount,
            currentSongs: enhancedSongs,
            totalServersWithPlayers: activePlayerCount
        };
    }
    
    // Initialize player for a guild
    getOrCreatePlayer(guildId) {
        if (!this.players.has(guildId)) {
            this.players.set(guildId, {
                connection: null,
                audioPlayer: createAudioPlayer(),
                queue: [],
                currentResource: null,
                lastMusicMessage: null
            });
        }
        return this.players.get(guildId);
    }
    
    // Check if URL is a YouTube URL
    isYouTubeURL(url) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;
        return youtubeRegex.test(url);
    }
    
    // Main play function
    async play(interaction) {
        await interaction.deferReply();
        
        const guildId = interaction.guildId;
        const voiceChannel = interaction.member.voice.channel;
        const url = interaction.options.getString('url');
        
        // Check if user is in a voice channel
        if (!voiceChannel) {
            return interaction.editReply({ embeds: [notoncall] });
        }
        
        // Validate YouTube URL
        if (!this.isYouTubeURL(url)) {
            return interaction.editReply({
                content: '❌ Please provide a valid YouTube URL.'
            });
        }
        
        const player = this.getOrCreatePlayer(guildId);
        
        // Create voice connection if needed
        if (!player.connection) {
            player.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator
            });
            player.connection.subscribe(player.audioPlayer);
        }
        
        try {
            // Check for YouTube Mix FIRST (highest priority)
            if (mixHandler.isYouTubeMix(url)) {
                return await handleYouTubeMix.call(this, interaction, url, player);
            }
            
            // Check if it looks like a playlist/mix
            const hasPlaylistParam = url.includes('list=');
            const listMatch = url.match(/[&?]list=([a-zA-Z0-9_-]+)/);
            const playlistId = listMatch ? listMatch[1] : null;
            
            if (hasPlaylistParam) {
                await this.handlePlaylist(interaction, url, player);
            } else {
                await this.handleSingleVideo(interaction, url, player);
            }
        } catch (error) {
            global.reportError(error, 'Play-Music-Main', 'Media');
            await interaction.editReply({
                content: '❌ An error occurred while processing your request.'
            });
        }
    }
    
    // Handle single video
    async handleSingleVideo(interaction, url, player) {
        try {
            // Try fast method first for better user experience
            let videoInfo;
            
            try {
                // Fast method: Direct ytdl.getInfo with timeout for responsiveness
                const infoPromise = ytdl.getInfo(url, { 
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                });
                
                // Add 8-second timeout for fast method
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Fast method timeout')), 8000)
                );
                
                const info = await Promise.race([infoPromise, timeoutPromise]);
                
                videoInfo = {
                    success: true,
                    title: info.videoDetails.title,
                    duration: parseInt(info.videoDetails.lengthSeconds) || 0,
                    thumbnail: info.videoDetails.thumbnails?.[0]?.url,
                    channel: info.videoDetails.author?.name || 'Unknown',
                    method: 'fast-ytdl'
                };
            } catch (fastError) {
                try {
                    // Fallback to robust method only if fast method fails
                    videoInfo = await this.videoExtractor.getVideoInfo(url);
                } catch (robustError) {
                    // Final fallback: extract basic info from URL
                    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
                    videoInfo = {
                        success: true,
                        title: videoId ? `YouTube Video ${videoId}` : 'Unknown Video',
                        duration: 0,
                        thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
                        channel: 'Unknown',
                        method: 'minimal-fallback'
                    };
                }
            }
            
            if (!videoInfo.success) {
                throw new Error(videoInfo.error);
            }
            
            const song = {
                title: videoInfo.title,
                url: url,
                duration: videoInfo.duration,
                thumbnail: this.getHDThumbnail(url, videoInfo.thumbnail),
                channel: videoInfo.channel,
                requestedBy: interaction.user.username,
                extractMethod: videoInfo.method
            };
            
            player.queue.push(song);
            
            if (player.audioPlayer.state.status !== AudioPlayerStatus.Playing) {
                this.playNext(interaction.guildId);
                await this.sendNowPlayingEmbed(interaction, song);
            } else {
                await interaction.editReply({
                    content: `✅ Added **${song.title}** to the queue (Position: ${player.queue.length})`
                });
            }
            
        } catch (error) {
            global.reportError(error, 'Play-Music-SingleVideo', 'Media');
            
            // Provide more specific error messages
            let errorMessage = '❌ Failed to process the video. Please check the URL and try again.';
            
            const errorMsg = error?.message || error?.toString() || '';
            if (errorMsg.includes('robot') || errorMsg.includes('captcha')) {
                errorMessage = '❌ YouTube is temporarily blocking requests. Please try again in a few minutes.';
            } else if (errorMsg.includes('429')) {
                errorMessage = '❌ Rate limit exceeded. Please wait a moment before trying again.';
            } else if (errorMsg.includes('Video unavailable')) {
                errorMessage = '❌ This video is unavailable, private, or age-restricted.';
            } else if (errorMsg.includes('All methods failed')) {
                errorMessage = '❌ Could not extract video information. The video may be unavailable or restricted.';
            }
            
            await interaction.editReply({ content: errorMessage });
        }
    }
    
    // Handle regular playlists (mixes are handled separately)
    async handlePlaylist(interaction, url, player) {
        try {
            const playlist = await ytpl(url, { limit: 50 });
            
            if (!playlist.items || playlist.items.length === 0) {
                return interaction.editReply({
                    content: '❌ This playlist is empty or unavailable.'
                });
            }
            
            let addedCount = 0;
            let skippedCount = 0;
            const wasEmpty = player.queue.length === 0 && player.audioPlayer.state.status !== AudioPlayerStatus.Playing;
            
            for (const item of playlist.items) {
                if (!item.id || item.title === '[Private video]' || item.title === '[Deleted video]') {
                    skippedCount++;
                    continue;
                }
                
                const songUrl = item.shortUrl || `https://www.youtube.com/watch?v=${item.id}`;
                
                // Skip detailed validation for playlists to speed up processing
                // Let individual songs fail during playback if needed
                const song = {
                    title: item.title,
                    url: songUrl,
                    duration: item.durationSec || 0,
                    thumbnail: this.getHDThumbnail(songUrl, item.bestThumbnail?.url || item.thumbnails?.[0]?.url),
                    channel: item.author?.name || 'Unknown',
                    requestedBy: interaction.user.username,
                    extractMethod: 'playlist-direct' // Mark as from playlist
                };
                
                player.queue.push(song);
                addedCount++;
            }
            
            if (wasEmpty && addedCount > 0) {
                this.playNext(interaction.guildId);
                // Wait a moment for the song to start, then show Now Playing embed
                setTimeout(async () => {
                    const currentSong = this.currentlyPlaying.get(interaction.guildId);
                    if (currentSong) {
                        await this.sendNowPlayingEmbed(interaction, currentSong);
                    } else {
                        // Fallback if currentlyPlaying isn't set yet
                        const message = `✅ Added **${addedCount}** songs from playlist **${playlist.title}** to the queue` +
                                       (skippedCount > 0 ? ` (${skippedCount} songs skipped)` : '') + '\n🎵 Playing now!';
                        await interaction.editReply({ content: message });
                    }
                }, 1000); // Wait 1 second for song to start
            } else {
                const message = `✅ Added **${addedCount}** songs from playlist **${playlist.title}** to the queue` +
                               (skippedCount > 0 ? ` (${skippedCount} songs skipped)` : '');
                await interaction.editReply({ content: message });
            }
            
        } catch (error) {
            global.reportError(error, 'Play-Music-Playlist', 'Media');
            
            // Fallback: try to extract and play single video from URL
            const videoMatch = url.match(/[&?]v=([a-zA-Z0-9_-]{11})/);
            if (videoMatch) {
                const videoId = videoMatch[1];
                const fallbackUrl = `https://www.youtube.com/watch?v=${videoId}`;
                
                await interaction.editReply({
                    content: '⚠️ Could not load playlist, but found a video. Playing that instead...'
                });
                
                return await this.handleSingleVideo(interaction, fallbackUrl, player);
            }
            
            await interaction.editReply({
                content: '❌ Failed to load playlist. It may be private or unavailable.'
            });
        }
    }
    
    // Play next song in queue
    playNext(guildId) {
        const player = this.players.get(guildId);
        
        if (!player || player.queue.length === 0) {
            this.currentlyPlaying.delete(guildId);
            if (player?.currentResource) {
                player.currentResource.audioPlayer = null;
                player.currentResource.encoder?.destroy();
                player.currentResource = null;
            }
            if (player) {
                player.lastMusicMessage = null; // Clear message reference when queue ends
            }
            return;
        }
        
        const nextSong = player.queue.shift();
        
        const attemptPlay = async () => {
            try {
                // Use fast streaming method for optimal performance
                const stream = ytdl(nextSong.url, {
                    filter: 'audioonly',
                    quality: 'highestaudio', // High quality audio for best experience
                    highWaterMark: 1 << 30, // Optimized buffer size for fast start
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Range': 'bytes=0-'
                        }
                    }
                });
                
                // Add error handling to the stream
                stream.on('error', (error) => {
                    const errorMsg = error?.message || error?.toString() || 'Unknown error';
                    // Only skip if it's a critical error, not 'aborted'
                    if (!errorMsg.includes('aborted')) {
                        global.reportError(error, 'Play-Music-StreamError', 'Media');
                        if (player.queue.length > 0) {
                            this.playNext(guildId);
                        }
                    }
                });

                // Add end handler to prevent aborted errors
                stream.on('end', () => {
                    // Stream ended naturally
                });

                stream.on('close', () => {
                    // Stream closed
                });

                const resource = createAudioResource(stream, {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: true
                });
                
                // Add error handling to the resource but don't crash on aborted
                resource.playStream.on('error', (error) => {
                    const errorMsg = error?.message || error?.toString() || 'Unknown error';
                    // Don't skip on aborted errors - they're normal when stopping/skipping
                    if (!errorMsg.includes('aborted')) {
                        global.reportError(error, 'Play-Music-ResourceError', 'Media');
                    }
                });
                
                // Clean up previous resource
                if (player.currentResource) {
                    try {
                        player.currentResource.audioPlayer = null;
                        if (player.currentResource.encoder) {
                            player.currentResource.encoder.destroy();
                        }
                    } catch (cleanupError) {
                        global.reportError(cleanupError, 'Play-Music-Cleanup', 'Media');
                    }
                }
                
                player.currentResource = resource;
                player.audioPlayer.play(resource);
                
                // Update currently playing
                this.currentlyPlaying.set(guildId, {
                    ...nextSong,
                    startTime: Date.now(),
                    isPaused: false,
                    pausedAt: null
                });
                
                // Set up event listener for when song ends
                player.audioPlayer.removeAllListeners('stateChange');
                player.audioPlayer.on('stateChange', async (oldState, newState) => {
                    if (newState.status === AudioPlayerStatus.Idle) {
                        this.playNext(guildId);
                        
                        // Auto-update embed when next song starts
                        setTimeout(async () => {
                            const newCurrentSong = this.currentlyPlaying.get(guildId);
                            if (newCurrentSong && player.lastMusicMessage) {
                                try {
                                    await this.updateMusicEmbedAuto(player.lastMusicMessage, newCurrentSong);
                                } catch (error) {
                                    // Silently handle embed update errors (message might be deleted)
                                }
                            }
                        }, 1000); // Wait 1 second for new song to load
                    }
                });
                
            } catch (error) {
                global.reportError(error, 'Play-Music-Stream', 'Media');
                
                // If this song fails, try the next one
                if (player.queue.length > 0) {
                    this.playNext(guildId);
                } else {
                    // No more songs, stop playback
                    this.currentlyPlaying.delete(guildId);
                    if (player.currentResource) {
                        player.currentResource.audioPlayer = null;
                        player.currentResource.encoder?.destroy();
                        player.currentResource = null;
                    }
                }
            }
        };
        
        attemptPlay();
    }
    
    // Send now playing embed
    async sendNowPlayingEmbed(interaction, song) {
        const duration = this.formatDuration(song.duration);
        
        const embed = new EmbedBuilder()
            .setColor('#00FF7F')
            .setTitle('🎵 Now Playing')
            .setDescription(`**${song.title}**`)
            .addFields(
                { name: '🎤 Artist/Channel', value: song.channel, inline: true },
                { name: '⏱️ Duration', value: duration || 'Live/Unknown', inline: true },
                { name: '👤 Requested by', value: song.requestedBy, inline: true },
                { name: '🔗 Source', value: '[Open on YouTube](' + song.url + ')', inline: false }
            )
            .setImage(song.thumbnail)
            .setFooter({ text: `🎶 Music Player | ${BOT_VERSION}` })
            .setTimestamp();
        
        // Media control buttons - First row
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`music_pause_${interaction.guildId}`)
                .setLabel('Pause')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`music_skip_${interaction.guildId}`)
                .setLabel('Skip')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`music_stop_${interaction.guildId}`)
                .setLabel('Stop')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`music_queue_${interaction.guildId}`)
                .setLabel('Queue')
                .setStyle(ButtonStyle.Secondary)
        );
        
        // Additional controls - Second row
        const extraRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`download_song_${interaction.guildId}`)
                .setLabel('Download')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setLabel('Play on YouTube')
                .setStyle(ButtonStyle.Link)
                .setURL(song.url),
            new ButtonBuilder()
                .setCustomId(`music_leave_${interaction.guildId}`)
                .setLabel('Leave')
                .setStyle(ButtonStyle.Danger)
        );
        
        await interaction.editReply({ embeds: [embed], components: [controlRow, extraRow] });
        
        // Store the message reference for auto-updates
        const message = await interaction.fetchReply();
        const player = this.players.get(interaction.guildId);
        if (player) {
            player.lastMusicMessage = message;
        }
    }
    
    // Format duration from seconds to MM:SS
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    // Update music embed based on current state
    async updateMusicEmbed(interaction, song, state, extraInfo = null) {
        let embed, controlRow, extraRow;
        
        switch (state) {
            case 'playing':
                embed = new EmbedBuilder()
                    .setColor('#00FF7F')
                    .setTitle('🎵 Now Playing')
                    .setDescription(song ? `**${song.title}**` : 'Music is playing')
                    .setFooter({ text: `🎶 Music Player | ${BOT_VERSION}` })
                    .setTimestamp();
                
                if (song) {
                    const duration = this.formatDuration(song.duration);
                    embed.addFields(
                        { name: '🎤 Artist/Channel', value: song.channel, inline: true },
                        { name: '⏱️ Duration', value: duration || 'Live/Unknown', inline: true },
                        { name: '👤 Requested by', value: song.requestedBy, inline: true },
                        { name: '🔗 Source', value: '[Open on YouTube](' + song.url + ')', inline: false }
                    ).setImage(song.thumbnail);
                }
                
                controlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`music_pause_${interaction.guildId}`)
                        .setLabel('Pause')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`music_skip_${interaction.guildId}`)
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`music_stop_${interaction.guildId}`)
                        .setLabel('Stop')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`music_queue_${interaction.guildId}`)
                        .setLabel('Queue')
                        .setStyle(ButtonStyle.Secondary)
                );
                
                if (song) {
                    extraRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`download_song_${interaction.guildId}`)
                            .setLabel('Download')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setLabel('Play on YouTube')
                            .setStyle(ButtonStyle.Link)
                            .setURL(song.url),
                        new ButtonBuilder()
                            .setCustomId(`music_leave_${interaction.guildId}`)
                            .setLabel('Leave')
                            .setStyle(ButtonStyle.Danger)
                    );
                }
                break;
                
            case 'paused':
                embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⏸️ Music Paused')
                    .setDescription(song ? `**${song.title}** is paused` : 'Playback paused')
                    .addFields(
                        { name: '💡 Status', value: 'Click Resume to continue playback', inline: false }
                    )
                    .setFooter({ text: `🎶 Paused by ${interaction.user.displayName}` })
                    .setTimestamp();
                
                if (song && song.thumbnail) {
                    embed.setThumbnail(song.thumbnail);
                }
                
                controlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`music_resume_${interaction.guildId}`)
                        .setLabel('Resume')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`music_skip_${interaction.guildId}`)
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`music_stop_${interaction.guildId}`)
                        .setLabel('Stop')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`music_queue_${interaction.guildId}`)
                        .setLabel('Queue')
                        .setStyle(ButtonStyle.Secondary)
                );
                break;
                
            case 'skipped':
                if (song) {
                    // New song is playing after skip
                    embed = new EmbedBuilder()
                        .setColor('#00FF7F')
                        .setTitle('⏭️ Skipped → Now Playing')
                        .setDescription(`**${song.title}**`)
                        .addFields(
                            { name: '⏮️ Previous', value: `Skipped: **${extraInfo}**`, inline: false },
                            { name: '🎤 Artist/Channel', value: song.channel, inline: true },
                            { name: '⏱️ Duration', value: this.formatDuration(song.duration) || 'Live/Unknown', inline: true },
                            { name: '👤 Requested by', value: song.requestedBy, inline: true }
                        )
                        .setImage(song.thumbnail)
                        .setFooter({ text: `🎶 Skipped by ${interaction.user.displayName}` })
                        .setTimestamp();
                    
                    controlRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`music_pause_${interaction.guildId}`)
                            .setLabel('Pause')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`music_skip_${interaction.guildId}`)
                            .setLabel('Skip')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`music_stop_${interaction.guildId}`)
                            .setLabel('Stop')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`music_queue_${interaction.guildId}`)
                            .setLabel('Queue')
                            .setStyle(ButtonStyle.Secondary)
                    );
                    
                    extraRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`download_song_${interaction.guildId}`)
                            .setLabel('Download')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setLabel('Play on YouTube')
                            .setStyle(ButtonStyle.Link)
                            .setURL(song.url),
                        new ButtonBuilder()
                            .setCustomId(`music_leave_${interaction.guildId}`)
                            .setLabel('Leave')
                            .setStyle(ButtonStyle.Danger)
                    );
                } else {
                    // No more songs in queue
                    embed = new EmbedBuilder()
                        .setColor('#6C757D')
                        .setTitle('⏭️ Queue Finished')
                        .setDescription(`Skipped: **${extraInfo}**\n\nNo more songs in the queue.`)
                        .addFields(
                            { name: '💡 What\'s next?', value: 'Add more music with `/play-music play` or leave the voice channel', inline: false }
                        )
                        .setFooter({ text: `🎶 Skipped by ${interaction.user.displayName}` })
                        .setTimestamp();
                    
                    controlRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`music_leave_${interaction.guildId}`)
                            .setLabel('Leave Voice Channel')
                            .setStyle(ButtonStyle.Danger)
                    );
                }
                break;
                
            case 'stopped':
                embed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('⏹️ Music Stopped')
                    .setDescription('Playback has been stopped and the queue has been cleared')
                    .addFields(
                        { name: '🗑️ Queue Status', value: 'All songs removed from queue', inline: true },
                        { name: '💡 Start Again', value: 'Use `/play-music play` with a new URL to start fresh', inline: true }
                    )
                    .setFooter({ text: `🎶 Stopped by ${interaction.user.displayName}` })
                    .setTimestamp();
                
                controlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`music_leave_${interaction.guildId}`)
                        .setLabel('Leave Voice Channel')
                        .setStyle(ButtonStyle.Danger)
                );
                break;
        }
        
        const components = extraRow ? [controlRow, extraRow] : [controlRow];
        await interaction.update({ embeds: [embed], components: components });
    }
    
    // Auto-update music embed when song changes (without user interaction)
    async updateMusicEmbedAuto(message, song) {
        if (!message || !song) return;
        
        try {
            const embed = new EmbedBuilder()
                .setColor('#00FF7F')
                .setTitle('🎵 Now Playing')
                .setDescription(`**${song.title}**`)
                .addFields(
                    { name: '🎤 Artist/Channel', value: song.channel, inline: true },
                    { name: '⏱️ Duration', value: this.formatDuration(song.duration) || 'Live/Unknown', inline: true },
                    { name: '👤 Requested by', value: song.requestedBy, inline: true },
                    { name: '🔗 Source', value: '[Open on YouTube](' + song.url + ')', inline: false }
                )
                .setImage(song.thumbnail)
                .setFooter({ text: `🎶 Music Player | ${BOT_VERSION}` })
                .setTimestamp();
            
            // Extract guildId from the song data or from the message
            const guildId = message.guildId || message.guild?.id;
            
            // Media control buttons
            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`music_pause_${guildId}`)
                    .setLabel('⏸Pause')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_skip_${guildId}`)
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`music_stop_${guildId}`)
                    .setLabel('Stop')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`music_queue_${guildId}`)
                    .setLabel('Queue')
                    .setStyle(ButtonStyle.Secondary)
            );
            
            // Additional controls
            const extraRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`download_song_${guildId}`)
                    .setLabel('Download')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setLabel('Play on YouTube')
                    .setStyle(ButtonStyle.Link)
                    .setURL(song.url),
                new ButtonBuilder()
                    .setCustomId(`music_leave_${guildId}`)
                    .setLabel('Leave')
                    .setStyle(ButtonStyle.Danger)
            );
            
            await message.edit({ embeds: [embed], components: [controlRow, extraRow] });
        } catch (error) {
            // Silently handle errors - message might be deleted or permissions changed
            // Don't report these errors as they're expected in normal operation
        }
    }
    
    // Pause the current song
    async pause(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player || player.audioPlayer.state.status !== AudioPlayerStatus.Playing) {
            return interaction.update({ content: '❌ Nothing is currently playing.', embeds: [], components: [] });
        }
        
        player.audioPlayer.pause();
        
        // Update pause state
        const currentSong = this.currentlyPlaying.get(guildId);
        if (currentSong) {
            currentSong.isPaused = true;
            currentSong.pausedAt = Date.now();
            this.currentlyPlaying.set(guildId, currentSong);
        }
        
        // Update the existing embed to show paused state
        await this.updateMusicEmbed(interaction, currentSong, 'paused');
    }
    
    // Resume the current song
    async resume(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player || player.audioPlayer.state.status !== AudioPlayerStatus.Paused) {
            return interaction.update({ content: '❌ Nothing is currently paused.', embeds: [], components: [] });
        }
        
        player.audioPlayer.unpause();
        
        // Update resume state
        const currentSong = this.currentlyPlaying.get(guildId);
        if (currentSong && currentSong.isPaused) {
            const pauseDuration = Date.now() - currentSong.pausedAt;
            currentSong.startTime += pauseDuration;
            currentSong.isPaused = false;
            currentSong.pausedAt = null;
            this.currentlyPlaying.set(guildId, currentSong);
        }
        
        // Update the existing embed to show playing state
        await this.updateMusicEmbed(interaction, currentSong, 'playing');
    }
    
    // Skip the current song
    async skip(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player || player.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            return interaction.update({ content: '❌ Nothing is currently playing.', embeds: [], components: [] });
        }
        
        const currentSong = this.currentlyPlaying.get(guildId);
        const skippedTitle = currentSong ? currentSong.title : 'Unknown Song';
        
        player.audioPlayer.stop(); // This will trigger the next song
        
        // Wait a moment for the next song to start, then update embed
        setTimeout(async () => {
            const newCurrentSong = this.currentlyPlaying.get(guildId);
            await this.updateMusicEmbed(interaction, newCurrentSong, 'skipped', skippedTitle);
        }, 500);
    }
    
    // Stop playback and clear queue
    async stop(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player) {
            return interaction.update({ content: '❌ No active music player.', embeds: [], components: [] });
        }
        
        player.audioPlayer.stop();
        player.queue = [];
        player.lastMusicMessage = null; // Clear message reference
        this.currentlyPlaying.delete(guildId);
        
        if (player.currentResource) {
            player.currentResource.audioPlayer = null;
            player.currentResource.encoder?.destroy();
            player.currentResource = null;
        }
        
        // Update embed to show stopped state
        await this.updateMusicEmbed(interaction, null, 'stopped');
    }
    
    // Show current queue
    async queue(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        const currentSong = this.currentlyPlaying.get(guildId);
        
        if (!player || (!currentSong && player.queue.length === 0)) {
            const emptyEmbed = new EmbedBuilder()
                .setColor('#6C757D')
                .setTitle('📃 Music Queue')
                .setDescription('🔇 **The queue is empty**\n\nAdd some music to get started!')
                .addFields(
                    { name: '💡 How to add music', value: 'Use `/play-music play` with a YouTube URL', inline: false }
                )
                .setFooter({ text: '🎶 Music Player' })
                .setTimestamp();
            
            // Simple control for empty queue (just leave button)
            const emptyControlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`music_leave_${interaction.guildId}`)
                    .setLabel('Leave Voice Channel')
                    .setStyle(ButtonStyle.Danger)
            );
            
            return interaction.update({ embeds: [emptyEmbed], components: [emptyControlRow] });
        }
        
        let queueText = '';
        let totalSongs = 0;
        
        if (currentSong) {
            const elapsed = Math.floor((Date.now() - currentSong.startTime) / 1000);
            const progress = currentSong.duration > 0 ? Math.floor((elapsed / currentSong.duration) * 100) : 0;
            const progressBar = '▓'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
            
            queueText += `**🎵 Currently Playing:**\n`;
            queueText += `**${currentSong.title}**\n`;
            queueText += `by ${currentSong.channel}\n`;
            queueText += `${progressBar} ${Math.min(progress, 100)}%\n\n`;
            totalSongs++;
        }
        
        if (player.queue.length > 0) {
            queueText += `**📃 Up Next (${player.queue.length} songs):**\n`;
            const queueList = player.queue.slice(0, 8).map((song, index) => 
                `\`${index + 1}.\` **${song.title}**\n   by ${song.channel}`
            ).join('\n');
            queueText += queueList;
            
            if (player.queue.length > 8) {
                queueText += `\n\n*...and ${player.queue.length - 8} more songs*`;
            }
            totalSongs += player.queue.length;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📃 Music Queue')
            .setDescription(queueText)
            .addFields(
                { name: '📊 Queue Stats', value: `${totalSongs} total song${totalSongs !== 1 ? 's' : ''}`, inline: true },
                { name: '🎛️ Controls', value: 'Use the buttons below to control playback', inline: true }
            )
            .setFooter({ text: '🎶 Music Player | Use controls below for quick access' })
            .setTimestamp();
        
        // Media control buttons for queue view
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`music_pause_${interaction.guildId}`)
                .setLabel('⏸Pause')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`music_skip_${interaction.guildId}`)
                .setLabel('Skip')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`music_stop_${interaction.guildId}`)
                .setLabel('Stop')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`music_leave_${interaction.guildId}`)
                .setLabel('Leave')
                .setStyle(ButtonStyle.Danger)
        );
        
        await interaction.update({ embeds: [embed], components: [controlRow] });
    }
    
    // Leave voice channel
    async leave(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player || !player.connection) {
            return interaction.update({ content: '❌ Not connected to a voice channel.', embeds: [], components: [] });
        }
        
        // Clean up
        player.audioPlayer.stop();
        player.queue = [];
        player.lastMusicMessage = null; // Clear message reference
        this.currentlyPlaying.delete(guildId);
        
        if (player.currentResource) {
            player.currentResource.audioPlayer = null;
            player.currentResource.encoder?.destroy();
            player.currentResource = null;
        }
        
        player.connection.destroy();
        this.players.delete(guildId);
        
        await interaction.update({ embeds: [left], components: [] });
    }
    
    // Download current song
    async downloadCurrentSong(interaction) {
        const guildId = interaction.guildId;
        const currentSong = this.currentlyPlaying.get(guildId);
        
        if (!currentSong) {
            return interaction.reply({ 
                content: '❌ No song is currently playing.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            // Create downloads directory if it doesn't exist
            const downloadsDir = path.join(process.cwd(), 'downloads');
            if (!fs.existsSync(downloadsDir)) {
                fs.mkdirSync(downloadsDir, { recursive: true });
            }
            
            // Clean filename for file system
            const cleanTitle = currentSong.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
            const filename = `${cleanTitle}.mp3`;
            const filepath = path.join(downloadsDir, filename);
            
            // Update user with progress
            await interaction.editReply({ 
                content: `🔄 Downloading **${currentSong.title}**...\nThis may take a moment depending on the song length.` 
            });
            
            // Download the audio stream with optimized settings
            const audioStream = ytdl(currentSong.url, {
                filter: 'audioonly',
                quality: 'highestaudio', // Consistent with streaming quality to avoid 403 errors
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            });
            
            // Create write stream
            const writeStream = fs.createWriteStream(filepath);
            
            // Pipe the audio stream to file
            audioStream.pipe(writeStream);
            
            // Wait for download to complete
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
                audioStream.on('error', reject);
            });
            
            // Check file size (Discord has 25MB limit for regular uploads)
            const stats = fs.statSync(filepath);
            const fileSizeInMB = stats.size / (1024 * 1024);
            
            if (fileSizeInMB > 25) {
                // Clean up the file
                fs.unlinkSync(filepath);
                
                // File too large for Discord
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('📥 File Too Large for Discord')
                    .setDescription(`This song is too big to send through Discord, but you can still enjoy it here!`)
                    .addFields(
                        { name: '🎵 Song', value: `**${currentSong.title}**`, inline: false },
                        { name: '📁 File Size', value: `${fileSizeInMB.toFixed(1)} MB`, inline: true },
                        { name: '⚠️ Discord Limit', value: '25 MB maximum', inline: true },
                        { name: '⏱️ Duration', value: this.formatDuration(currentSong.duration) || 'Unknown', inline: true },
                        { name: '� Suggestions', value: '• Try downloading shorter songs (under 25MB)\n• Stream the song directly from YouTube\n• Use YouTube Premium for offline downloads', inline: false }
                    )
                    .setThumbnail(currentSong.thumbnail)
                    .setFooter({ text: '🎶 Music Player | File size limitation' })
                    .setTimestamp();
                
                return await interaction.editReply({ 
                    content: '', 
                    embeds: [embed]
                });
            }
            
            // Create attachment and send
            const attachment = new AttachmentBuilder(filepath, { name: filename });
            
            const embed = new EmbedBuilder()
                .setColor('#00FF7F')
                .setTitle('📥 Download Ready!')
                .setDescription(`Your download is complete and ready to enjoy!`)
                .addFields(
                    { name: '🎵 Song', value: `**${currentSong.title}**`, inline: false },
                    { name: '🎤 Artist', value: currentSong.channel, inline: true },
                    { name: '📁 Size', value: `${fileSizeInMB.toFixed(2)} MB`, inline: true },
                    { name: '⏱️ Duration', value: this.formatDuration(currentSong.duration) || 'Unknown', inline: true },
                    { name: '� Format', value: 'MP3 Audio (High Quality)', inline: true },
                    { name: '💡 Note', value: 'File will be automatically deleted in 30 seconds', inline: true }
                )
                .setThumbnail(currentSong.thumbnail)
                .setFooter({ text: `🎶 Downloaded by ${interaction.user.displayName}` })
                .setTimestamp();
            
            const playButton = new ButtonBuilder()
                .setLabel('Play on YouTube')
                .setStyle(ButtonStyle.Link)
                .setURL(currentSong.url);
            
            const row = new ActionRowBuilder().addComponents(playButton);
            
            await interaction.editReply({ 
                content: '✅ Your download is ready!',
                embeds: [embed], 
                components: [row],
                files: [attachment]
            });
            
            // Clean up the file after sending (optional, comment out if you want to keep files)
            setTimeout(() => {
                try {
                    if (fs.existsSync(filepath)) {
                        fs.unlinkSync(filepath);
                    }
                } catch (error) {
                    global.reportError(error, 'Play-Music-FileCleanup', 'Media');
                }
            }, 30000); // Delete after 30 seconds
            
        } catch (error) {
            global.reportError(error, 'Play-Music-Download', 'Media');
            
            // Show error message without external fallbacks
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('📥 Download Failed')
                .setDescription(`Sorry, we couldn't download this song right now.`)
                .addFields(
                    { name: '🎵 Song', value: `**${currentSong.title}**`, inline: false },
                    { name: '🎤 Artist', value: currentSong.channel, inline: true },
                    { name: '❌ Issue', value: 'Download temporarily unavailable', inline: true },
                    { name: '� What you can do', value: '• Try again in a few minutes\n• Check if the song is still available on YouTube\n• Try downloading a different song', inline: false }
                )
                .setThumbnail(currentSong.thumbnail)
                .setFooter({ text: '🎶 Music Player | Try again later' })
                .setTimestamp();
            
            await interaction.editReply({ 
                content: '',
                embeds: [embed]
            });
        }
    }
    
    // Handle button interactions for download and media controls
    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;
        
        // Download button
        if (customId.startsWith('download_song_')) {
            const guildId = customId.replace('download_song_', '');
            if (interaction.guildId === guildId) {
                await this.downloadCurrentSong(interaction);
            } else {
                await interaction.reply({
                    content: '❌ This download button is not valid for this server.',
                    flags: MessageFlags.Ephemeral
                });
            }
            return;
        }
        
        // Media control buttons
        if (customId.startsWith('music_')) {
            const [, action, guildId] = customId.split('_');
            
            if (interaction.guildId !== guildId) {
                await interaction.reply({
                    content: '❌ This control is not valid for this server.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            
            try {
                switch (action) {
                    case 'pause':
                        await this.pause(interaction);
                        break;
                    case 'resume':
                        await this.resume(interaction);
                        break;
                    case 'skip':
                        await this.skip(interaction);
                        break;
                    case 'stop':
                        await this.stop(interaction);
                        break;
                    case 'queue':
                        await this.queue(interaction);
                        break;
                    case 'leave':
                        await this.leave(interaction);
                        break;
                    default:
                        await interaction.reply({
                            content: '❌ Unknown control action.',
                            flags: MessageFlags.Ephemeral
                        });
                }
            } catch (error) {
                global.reportError(error, 'Play-Music-ButtonControl', 'Media');
                await interaction.reply({
                    content: '❌ An error occurred while processing your request.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
}

// Singleton pattern - create a single instance
const musicManager = new MusicManager();

// Initialize YouTube Mix cache cleaning
const { setupCacheCleaning } = require(path.join(__dirname, 'modules', 'YouTubeMixIntegration'));
setupCacheCleaning();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play-music')
        .setDescription('Play music from YouTube (videos, playlists, and mixes supported)')
        .addStringOption(option => 
            option.setName('url')
            .setDescription('YouTube URL (video, playlist, or mix)')
            .setRequired(true)
        ),

    execute: async (interaction) => {
        try{
            const url = interaction.options.getString('url');
            await musicManager.play(interaction);
        }catch(error){
            await interaction.reply({embeds: [bug]});
            global.reportError(error, 'Play-Music', 'Media');
        }
    },
    
    // Export the music manager instance for web dashboard access
    musicManager: musicManager,
    
    // Handle button interactions
    handleButtonInteraction: async (interaction) => {
        return await musicManager.handleButtonInteraction(interaction);
    }
}