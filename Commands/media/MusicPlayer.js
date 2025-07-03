const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder} = require('discord.js');
const {bug, failedtoplay, notoncall, left} = require('../../handlers/embed.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, StreamType} = require('@discordjs/voice');
const {BOT_VERSION} = require('../../handlers/config.json');
const ytdl = require('@distube/ytdl-core');
const ytpl = require('@distube/ytpl');
const { mixHandler, handleYouTubeMix } = require('./modules/YouTubeMixIntegration');
const VideoInfoExtractor = require('./modules/VideoInfoExtractor');
const fs = require('fs');
const path = require('path');

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
            const isRetryableError = error.message.includes('429') || 
                                   error.message.includes('robot') ||
                                   error.message.includes('captcha') ||
                                   error.message.includes('rate limit');
            
            if (!isRetryableError) {
                throw error;
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
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
            console.log('Error getting HD thumbnail:', error.message);
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
                currentResource: null
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
                content: '❌ Please provide a valid YouTube URL.',
                flags: MessageFlags.Ephemeral
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
            console.error('Error in play function:', error);
            await interaction.editReply({
                content: '❌ An error occurred while processing your request.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
    
    // Handle single video
    async handleSingleVideo(interaction, url, player) {
        try {
            // Use the robust video extractor instead of direct ytdl.getInfo
            console.log('Extracting video info using robust method...');
            const videoInfo = await this.videoExtractor.getVideoInfo(url);
            
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
            console.error('Error handling single video:', error);
            
            // Provide more specific error messages
            let errorMessage = '❌ Failed to process the video. Please check the URL and try again.';
            
            if (error.message.includes('robot') || error.message.includes('captcha')) {
                errorMessage = '❌ YouTube is temporarily blocking requests. Please try again in a few minutes.';
            } else if (error.message.includes('429')) {
                errorMessage = '❌ Rate limit exceeded. Please wait a moment before trying again.';
            } else if (error.message.includes('Video unavailable')) {
                errorMessage = '❌ This video is unavailable, private, or age-restricted.';
            } else if (error.message.includes('All methods failed')) {
                errorMessage = '❌ Could not extract video information. The video may be unavailable or restricted.';
            }
            
            await interaction.editReply({ content: errorMessage });
        }
    }
    
    // Handle regular playlists (mixes are handled separately)
    async handlePlaylist(interaction, url, player) {
        try {
            await interaction.editReply({ content: '🔄 Loading playlist...' });
            
            const playlist = await ytpl(url, { limit: 50 });
            
            if (!playlist.items || playlist.items.length === 0) {
                return interaction.editReply({
                    content: '❌ This playlist is empty or unavailable.'
                });
            }
            
            let addedCount = 0;
            let skippedCount = 0;
            const wasEmpty = player.queue.length === 0 && player.audioPlayer.state.status !== AudioPlayerStatus.Playing;
            
            await interaction.editReply({ content: '🔄 Processing playlist songs...' });
            
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
                
                // Update progress every 10 songs
                if (addedCount % 10 === 0) {
                    await interaction.editReply({ 
                        content: `🔄 Added ${addedCount}/${playlist.items.length} songs...` 
                    });
                }
            }
            
            if (wasEmpty && addedCount > 0) {
                this.playNext(interaction.guildId);
                await this.sendPlaylistEmbed(interaction, playlist, addedCount, false, skippedCount);
            } else {
                const message = `✅ Added **${addedCount}** songs from playlist **${playlist.title}** to the queue` +
                               (skippedCount > 0 ? ` (${skippedCount} songs skipped)` : '');
                await interaction.editReply({ content: message });
            }
            
        } catch (error) {
            console.error('Error handling playlist:', error);
            
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
            return;
        }
        
        const nextSong = player.queue.shift();
        
        const attemptPlay = async () => {
            try {
                // Try multiple streaming approaches with fallbacks
                let stream;
                let streamCreated = false;
                
                // Method 1: Try basic ytdl without extra options
                try {
                    stream = ytdl(nextSong.url, {
                        filter: 'audioonly',
                        quality: 'highestaudio',
                        highWaterMark: 1 << 25, // Add buffering back
                        requestOptions: {
                            headers: {
                                'Range': 'bytes=0-'
                            }
                        }
                    });
                    streamCreated = true;
                } catch (basicError) {
                    // Basic ytdl failed, continue to next method
                }
                
                // Method 2: Try without any options if basic failed
                if (!streamCreated) {
                    try {
                        console.log('Trying minimal ytdl streaming...');
                        stream = ytdl(nextSong.url, {
                            highWaterMark: 1 << 25 // Keep buffering even in minimal mode
                        });
                        streamCreated = true;
                        console.log('Minimal ytdl stream created successfully');
                    } catch (minimalError) {
                        console.log('Minimal ytdl failed:', minimalError.message);
                    }
                }
                
                if (!streamCreated) {
                    throw new Error('All streaming methods failed');
                }
                
                // Add error handling to the stream
                stream.on('error', (error) => {
                    console.log(`Stream error (non-fatal): ${error.message}`);
                    // Only skip if it's a critical error, not 'aborted'
                    if (!error.message.includes('aborted')) {
                        if (player.queue.length > 0) {
                            console.log('Non-aborted error, skipping to next song...');
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
                    console.log(`Resource stream error (non-fatal): ${error.message}`);
                    // Don't skip on aborted errors - they're normal when stopping/skipping
                    if (!error.message.includes('aborted')) {
                        console.log('Non-aborted resource error, this might be serious');
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
                        console.log('Cleanup error (non-fatal):', cleanupError.message);
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
                player.audioPlayer.on('stateChange', (oldState, newState) => {
                    if (newState.status === AudioPlayerStatus.Idle) {
                        this.playNext(guildId);
                    }
                });
                
            } catch (error) {
                console.error('Error playing song:', error.message);
                console.log(`Failed to play: ${nextSong.title} - skipping to next song`);
                
                // If this song fails, try the next one
                if (player.queue.length > 0) {
                    console.log(`Trying next song in queue (${player.queue.length} remaining)...`);
                    this.playNext(guildId);
                } else {
                    console.log('No more songs in queue, stopping playback');
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
            .setColor('#0099ff')
            .setAuthor({ 
                name: "Now Playing", 
                iconURL: "https://cdn-icons-png.flaticon.com/512/2468/2468825.png" 
            })
            .setImage(song.thumbnail)
            .addFields(
                { name: 'Title', value: `\`\`\`${song.title}\`\`\`` },
                { name: 'Duration', value: `\`\`\`${duration || 'Unknown'}\`\`\``, inline: true },
                { name: 'Channel', value: `\`\`\`${song.channel}\`\`\``, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag} | ${BOT_VERSION}` })
            .setTimestamp();
        
        const playButton = new ButtonBuilder()
            .setLabel('Play on YouTube')
            .setStyle(ButtonStyle.Link)
            .setURL(song.url);
        
        const downloadButton = new ButtonBuilder()
            .setCustomId(`download_song_${interaction.guildId}`)
            .setLabel('📥 Download Song')
            .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder().addComponents(playButton, downloadButton);
        
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
    
    // Send playlist embed
    async sendPlaylistEmbed(interaction, playlist, addedCount, isMix = false, skippedCount = 0) {
        const playlistType = isMix ? '🎵 Mix' : '📋 Playlist';
        const emoji = isMix ? '🎲' : '📋';
        
        const embed = new EmbedBuilder()
            .setColor(isMix ? '#FF6B6B' : '#4285F4')
            .setTitle(`${emoji} ${isMix ? 'Mix' : 'Playlist'} Added!`)
            .setDescription(`**${playlist.title}**`)
            .addFields(
                { name: '🎵 Songs Added', value: `${addedCount}`, inline: true },
                { name: '👤 Author', value: playlist.author?.name || 'YouTube', inline: true },
                { name: '📊 Total Videos', value: `${playlist.estimatedItemCount || playlist.items?.length || addedCount}`, inline: true }
            )
            .setThumbnail(playlist.bestThumbnail?.url || playlist.thumbnails?.[0]?.url)
            .setFooter({ text: `${isMix ? 'Mix ID: ' + playlist.id : 'Playlist ID: ' + playlist.id} | ${BOT_VERSION}` })
            .setTimestamp();
        
        if (skippedCount > 0) {
            embed.addFields({
                name: '⚠️ Skipped',
                value: `${skippedCount} songs were skipped (unavailable or restricted)`,
                inline: false
            });
        }
        
        if (isMix) {
            embed.addFields({
                name: '💡 Note',
                value: 'This is a YouTube Mix - songs are dynamically generated based on your selection.',
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
    }
    
    // Send enhanced mix embed with first song thumbnail
    async sendEnhancedMixEmbed(interaction, playlist, addedCount, firstSong, skippedCount = 0) {
        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🎲 YouTube Mix Added!')
            .setDescription(`**${playlist.title}**`)
            .addFields(
                { name: '🎵 Songs Added', value: `${addedCount}`, inline: true },
                { name: '👤 Author', value: playlist.author?.name || 'YouTube', inline: true },
                { name: '📊 Total Videos', value: `${playlist.estimatedItemCount || addedCount}`, inline: true }
            )
            .setFooter({ text: `Mix ID: ${playlist.id} | ${BOT_VERSION}` })
            .setTimestamp();
        
        // Add the first song's thumbnail as the main image
        if (firstSong && firstSong.thumbnail) {
            embed.setImage(firstSong.thumbnail);
            embed.addFields({
                name: '🎵 Now Starting',
                value: `**${firstSong.title}**\nby ${firstSong.channel}`,
                inline: false
            });
        }
        
        if (skippedCount > 0) {
            embed.addFields({
                name: '⚠️ Skipped',
                value: `${skippedCount} songs were skipped (unavailable or restricted)`,
                inline: false
            });
        }
        
        embed.addFields({
            name: '💡 Note',
            value: 'This is a YouTube Mix - songs are dynamically generated based on your selection.',
            inline: false
        });
        
        // Add download button for the first song if available
        let row = null;
        if (firstSong && firstSong.url) {
            const downloadButton = new ButtonBuilder()
                .setCustomId(`download_song_${interaction.guildId}`)
                .setLabel('📥 Download Current Song')
                .setStyle(ButtonStyle.Secondary);
            
            const playButton = new ButtonBuilder()
                .setLabel('Play on YouTube')
                .setStyle(ButtonStyle.Link)
                .setURL(firstSong.url);
            
            row = new ActionRowBuilder().addComponents(downloadButton, playButton);
        }
        
        // Update footer
        embed.setFooter({ text: `Mix ID: ${playlist.id} | ${BOT_VERSION}` });
        
        await interaction.editReply({ 
            embeds: [embed], 
            components: row ? [row] : [] 
        });
    }
    
    // Format duration from seconds to MM:SS
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    // Pause the current song
    async pause(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player || player.audioPlayer.state.status !== AudioPlayerStatus.Playing) {
            return interaction.reply({ content: '❌ Nothing is currently playing.' });
        }
        
        player.audioPlayer.pause();
        
        // Update pause state
        const currentSong = this.currentlyPlaying.get(guildId);
        if (currentSong) {
            currentSong.isPaused = true;
            currentSong.pausedAt = Date.now();
            this.currentlyPlaying.set(guildId, currentSong);
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⏸️ Paused')
            .setDescription(currentSong ? currentSong.title : 'Music paused')
            .setFooter({ text: `Requested by ${interaction.user.tag} | ${BOT_VERSION}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
    
    // Resume the current song
    async resume(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player || player.audioPlayer.state.status !== AudioPlayerStatus.Paused) {
            return interaction.reply({ content: '❌ Nothing is currently paused.' });
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
        
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('▶️ Resumed')
            .setDescription(currentSong ? currentSong.title : 'Music resumed')
            .setFooter({ text: `Requested by ${interaction.user.tag} | ${BOT_VERSION}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
    
    // Skip the current song
    async skip(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player || player.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            return interaction.reply({ content: '❌ Nothing is currently playing.' });
        }
        
        const currentSong = this.currentlyPlaying.get(guildId);
        player.audioPlayer.stop(); // This will trigger the next song
        
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⏭️ Skipped')
            .setDescription(currentSong ? `Skipped: ${currentSong.title}` : 'Song skipped')
            .setFooter({ text: `Requested by ${interaction.user.tag} | ${BOT_VERSION}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
    
    // Stop playback and clear queue
    async stop(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player) {
            return interaction.reply({ content: '❌ No active music player.' });
        }
        
        player.audioPlayer.stop();
        player.queue = [];
        this.currentlyPlaying.delete(guildId);
        
        if (player.currentResource) {
            player.currentResource.audioPlayer = null;
            player.currentResource.encoder?.destroy();
            player.currentResource = null;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⏹️ Stopped')
            .setDescription('Music playback stopped and queue cleared.')
            .setFooter({ text: `Requested by ${interaction.user.tag} | ${BOT_VERSION}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
    
    // Show current queue
    async queue(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        const currentSong = this.currentlyPlaying.get(guildId);
        
        if (!player || (!currentSong && player.queue.length === 0)) {
            return interaction.reply({ content: '❌ The queue is empty.' });
        }
        
        let queueText = '';
        
        if (currentSong) {
            queueText += `**🎵 Now Playing:**\n${currentSong.title}\n\n`;
        }
        
        if (player.queue.length > 0) {
            queueText += `**📃 Up Next:**\n`;
            const queueList = player.queue.slice(0, 10).map((song, index) => 
                `${index + 1}. ${song.title}`
            ).join('\n');
            queueText += queueList;
            
            if (player.queue.length > 10) {
                queueText += `\n... and ${player.queue.length - 10} more`;
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📃 Music Queue')
            .setDescription(queueText)
            .setFooter({ text: `Total songs: ${player.queue.length + (currentSong ? 1 : 0)} | ${BOT_VERSION}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
    
    // Leave voice channel
    async leave(interaction) {
        const guildId = interaction.guildId;
        const player = this.players.get(guildId);
        
        if (!player || !player.connection) {
            return interaction.reply({ content: '❌ Not connected to a voice channel.' });
        }
        
        // Clean up
        player.audioPlayer.stop();
        player.queue = [];
        this.currentlyPlaying.delete(guildId);
        
        if (player.currentResource) {
            player.currentResource.audioPlayer = null;
            player.currentResource.encoder?.destroy();
            player.currentResource = null;
        }
        
        player.connection.destroy();
        this.players.delete(guildId);
        
        await interaction.reply({ embeds: [left] });
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
            
            // Download the audio stream
            const audioStream = ytdl(currentSong.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                format: 'mp3'
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
                    .setColor('#FF6B6B')
                    .setTitle('📥 File Too Large for Discord')
                    .setDescription(`**${currentSong.title}** is too large (${fileSizeInMB.toFixed(1)}MB) for Discord upload.\n\nDiscord has a 25MB file size limit. Please try a shorter song or use the command '/play-music download' for other options.`)
                    .addFields(
                        { name: '🎵 Song', value: `\`\`\`${currentSong.title}\`\`\`` },
                        { name: '⏱️ Duration', value: `\`\`\`${this.formatDuration(currentSong.duration) || 'Unknown'}\`\`\``, inline: true },
                        { name: '� File Size', value: `\`\`\`${fileSizeInMB.toFixed(1)} MB\`\`\``, inline: true }
                    )
                    .setThumbnail(currentSong.thumbnail)
                    .setFooter({ text: `Requested by ${interaction.user.tag} | ${BOT_VERSION}` })
                    .setTimestamp();
                
                return await interaction.editReply({ 
                    content: '', 
                    embeds: [embed]
                });
            }
            
            // Create attachment and send
            const attachment = new AttachmentBuilder(filepath, { name: filename });
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('📥 Download Complete!')
                .setDescription(`**${currentSong.title}**\nby ${currentSong.channel}`)
                .addFields(
                    { name: '📁 File Size', value: `\`\`\`${fileSizeInMB.toFixed(2)} MB\`\`\``, inline: true },
                    { name: '⏱️ Duration', value: `\`\`\`${this.formatDuration(currentSong.duration) || 'Unknown'}\`\`\``, inline: true },
                    { name: '🎵 Format', value: `\`\`\`MP3 Audio\`\`\``, inline: true }
                )
                .setThumbnail(currentSong.thumbnail)
                .setFooter({ text: `Requested by ${interaction.user.tag} | ${BOT_VERSION}` })
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
                        console.log(`Cleaned up downloaded file: ${filename}`);
                    }
                } catch (error) {
                    console.log(`Failed to clean up file ${filename}:`, error.message);
                }
            }, 30000); // Delete after 30 seconds
            
        } catch (error) {
            console.error('Download error:', error);
            
            // Show error message without external fallbacks
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('📥 Download Failed')
                .setDescription(`Failed to download **${currentSong.title}** directly.`)
                .addFields(
                    { name: '❌ Error', value: `\`\`\`${error.message}\`\`\`` },
                    { name: '🎵 Song', value: `\`\`\`${currentSong.title}\`\`\`` },
                    { name: '📺 Channel', value: `\`\`\`${currentSong.channel}\`\`\``, inline: true }
                )
                .setThumbnail(currentSong.thumbnail)
                .setFooter({ text: `Requested by ${interaction.user.tag} | Try again later | ${BOT_VERSION}` })
                .setTimestamp();
            
            await interaction.editReply({ 
                content: '',
                embeds: [embed]
            });
        }
    }
    
    // Handle button interactions for download
    async handleButtonInteraction(interaction) {
        if (interaction.customId.startsWith('download_song_')) {
            // Extract guild ID from custom ID
            const guildId = interaction.customId.replace('download_song_', '');
            
            // Set the guild ID for the interaction if it matches
            if (interaction.guildId === guildId) {
                await this.downloadCurrentSong(interaction);
            } else {
                await interaction.reply({
                    content: '❌ This download button is not valid for this server.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
}

// Singleton pattern - create a single instance
const musicManager = new MusicManager();

// Initialize YouTube Mix cache cleaning
const { setupCacheCleaning } = require('./YouTubeMixIntegration');
setupCacheCleaning();

module.exports = {
    data: new SlashCommandBuilder()
    .setName('play-music')
    .setDescription('Play music from YouTube (videos, playlists, and mixes supported)')
    .addStringOption(option =>
        option.setName('controls')
        .setDescription('Player Controls')
        .addChoices(
            {name: 'Play', value: 'play'},
            {name: 'Pause', value: 'pause'},
            { name: 'Resume', value: 'resume' },
            {name: 'Skip', value: 'skip'},
            {name: 'Stop', value: 'stop'},
            {name: 'Queue', value: 'queue'},
            {name: 'Download Current Song', value: 'download'},
            {name: 'Leave', value: 'leave'}
        )
        .setRequired(true)
    )
    .addStringOption(option => 
        option.setName('url')
        .setDescription('YouTube URL (video, playlist, or mix - ytpl will auto-detect)')
        .setRequired(false)
    ),

    execute: async (interaction) => {
        try{
            const action = interaction.options.getString('controls');
            const url = interaction.options.getString('url');

            switch(action){
                case 'play':
                    if(!url){
                        return interaction.reply({embeds: [failedtoplay]});
                    }
                    await musicManager.play(interaction);
                    break;
                case 'pause':
                    await musicManager.pause(interaction);
                    break;
                case 'resume':
                    await musicManager.resume(interaction);
                    break;
                case 'skip':
                    await musicManager.skip(interaction);
                    break;
                case 'stop':
                    await musicManager.stop(interaction);
                    break;
                case 'queue': 
                    await musicManager.queue(interaction);
                    break;
                case 'download':
                    await musicManager.downloadCurrentSong(interaction);
                    break;
                case 'leave':
                    await musicManager.leave(interaction);
                    break;
            }
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