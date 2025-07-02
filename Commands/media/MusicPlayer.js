const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags} = require('discord.js');
const {bug, failedtoplay, notoncall, left} = require('../../handlers/embed.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, StreamType} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytpl = require('ytpl');
const {BOT_VERSION} = require('../../handlers/config.json');

class MusicManager{
    constructor(){
        this.Player = new Map();
        this.currentlyPlaying = new Map();
    }
    
    // Method to get all currently playing music across servers
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
    
    // Method to get music data for web dashboard
    getWebDashboardData() {
        const playingMusic = this.getAllCurrentlyPlaying();
        const activePlayerCount = this.Player.size;
        
        // Enhance with queue information and progress
        const enhancedSongs = playingMusic.map(song => {
            const player = this.Player.get(song.guildId);
            const currentTime = Date.now();
            let elapsedSeconds = 0;
            
            if (song.startTime) {
                if (song.isPaused && song.pausedAt) {
                    // If paused, calculate elapsed time up to pause
                    elapsedSeconds = Math.floor((song.pausedAt - song.startTime) / 1000);
                } else {
                    // If playing, calculate current elapsed time
                    elapsedSeconds = Math.floor((currentTime - song.startTime) / 1000);
                }
            }
            
            return {
                ...song,
                queueLength: player ? player.queue.length : 0,
                playerStatus: player ? player.player.state.status : 'idle',
                elapsedSeconds: Math.max(0, elapsedSeconds),
                progressPercent: song.duration > 0 ? Math.min((elapsedSeconds / song.duration) * 100, 100) : 0
            };
        });
        
        return {
            hasActiveMusic: playingMusic.length > 0,
            activePlayersCount: activePlayerCount,
            currentSongs: enhancedSongs,
            totalServersWithPlayers: activePlayerCount
        };
    }
    
    async play(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        const voicech = interaction.member.voice.channel;
        
        // Server Specific Player
        if (!this.Player.has(guildId)) {
            this.Player.set(guildId, {
                connection: null,
                player: createAudioPlayer(),
                queue: [],
                state: null
            });
        }
        const player = this.Player.get(guildId);

        // Check if user is in a voice channel
        if (!voicech) {
            return interaction.reply({embeds: [notoncall]});
        }
        
        // Create Voice Connection
        if (!player.connection) {
            player.connection = joinVoiceChannel({
                channelId: voicech.id,
                guildId: guildId,
                adapterCreator: voicech.guild.voiceAdapterCreator
            });
            player.connection.subscribe(player.player);
        }

        // Get URL and detect its type
        const url = interaction.options.getString('url');
        const urlInfo = this.detectYouTubeUrlType(url);
        
        // Handle different URL types
        await this.handleUrlType(interaction, url, urlInfo);
    }
    
    // Helper method to detect YouTube URL types
    detectYouTubeUrlType(url) {
        const urlPatterns = {
            // Single video patterns
            singleVideo: /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?!.*[&?]list=)/,
            
            // Playlist patterns (including mixes)
            playlist: /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})&list=([a-zA-Z0-9_-]+)/,
            playlistOnly: /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
            
            // Mix patterns (Radio mixes start with RD)
            mix: /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})&list=(RD[a-zA-Z0-9_-]+)/,
            radioMix: /start_radio=1/
        };
        
        if (urlPatterns.mix.test(url) || urlPatterns.radioMix.test(url)) {
            return { type: 'mix', url };
        } else if (urlPatterns.playlist.test(url)) {
            return { type: 'playlist', url };
        } else if (urlPatterns.playlistOnly.test(url)) {
            return { type: 'playlistOnly', url };
        } else if (urlPatterns.singleVideo.test(url)) {
            return { type: 'single', url };
        } else {
            return { type: 'unknown', url };
        }
    }
    
    // Helper method to extract video ID from URL
    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }
    
    // Helper method to extract playlist ID from URL
    extractPlaylistId(url) {
        const match = url.match(/[&?]list=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }
    
    // Method to handle different URL types
    async handleUrlType(interaction, url, urlInfo) {
        const guildId = interaction.guildId;
        
        switch (urlInfo.type) {
            case 'single':
                await this.addSingleVideo(interaction, url);
                break;
                
            case 'mix':
                await this.handleMixPlaylist(interaction, url);
                break;
                
            case 'playlist':
            case 'playlistOnly':
                await this.handleRegularPlaylist(interaction, url);
                break;
                
            default:
                await interaction.editReply({
                    content: '❌ Invalid YouTube URL. Please provide a valid YouTube video, playlist, or mix link.',
                    flags: MessageFlags.Ephemeral
                });
        }
    }
    
    // Handle YouTube Mix/Radio playlists
    async handleMixPlaylist(interaction, url) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);
        
        try {
            // For mix playlists, we'll start with the main video and let users know it's a mix
            const videoId = this.extractVideoId(url);
            const playlistId = this.extractPlaylistId(url);
            
            if (!videoId) {
                return await interaction.editReply({
                    content: '❌ Could not extract video ID from the mix URL.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            // Add the main video from the mix
            const singleVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            await this.addSingleVideo(interaction, singleVideoUrl, false); // Show Now Playing
            
            // Send additional info about mix detection as follow-up
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🎵 YouTube Mix/Radio Detected!')
                .setDescription(`Playing from YouTube Mix/Radio playlist.`)
                .addFields(
                    { name: '� Now Playing', value: 'The selected song from the mix', inline: false },
                    { name: '💡 Note', value: 'Mix playlists are dynamic - each song is added individually', inline: false }
                )
                .setFooter({ text: `Mix ID: ${playlistId} | ${BOT_VERSION}` })
                .setTimestamp();
                
            // Send the mix info as a follow-up message
            setTimeout(async () => {
                try {
                    await interaction.followUp({ embeds: [embed] });
                } catch (error) {
                    console.log('Could not send follow-up embed:', error.message);
                }
            }, 2000); // Wait 2 seconds before sending follow-up
            
        } catch (error) {
            console.error('Error handling mix playlist:', error);
            await interaction.editReply({
                content: '❌ Error processing YouTube mix. Playing the main video instead.',
                flags: MessageFlags.Ephemeral
            });
            
            // Fallback to single video
            const videoId = this.extractVideoId(url);
            if (videoId) {
                const singleVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                await this.addSingleVideo(interaction, singleVideoUrl);
            }
        }
    }
    
    // Handle regular YouTube playlists - FULL PLAYLIST SUPPORT
    async handleRegularPlaylist(interaction, url) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);
        
        try {
            const playlistId = this.extractPlaylistId(url);
            
            if (!playlistId) {
                return await interaction.editReply({
                    content: '❌ Could not extract playlist ID from the URL.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            // Try to get playlist information using ytpl with proper configuration
            let playlist;
            try {
                // Configure ytpl with options that should work without authentication
                playlist = await ytpl(playlistId, { 
                    limit: 50,
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    }
                });
            } catch (ytplError) {
                console.log('ytpl failed, falling back to single video approach:', ytplError.message);
                
                // Fallback: try to get just the specific video from the playlist URL
                const videoId = this.extractVideoId(url);
                if (videoId) {
                    const singleVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    await this.addSingleVideo(interaction, singleVideoUrl, false);
                    
                    // Send fallback message
                    setTimeout(async () => {
                        try {
                            const embed = new EmbedBuilder()
                                .setColor('#FFA500')
                                .setTitle('⚠️ Playlist Partially Loaded')
                                .setDescription('Could not load the full playlist, but playing the selected video.')
                                .addFields(
                                    { name: '🎵 Now Playing', value: 'The selected video from the playlist', inline: false },
                                    { name: '💡 Note', value: 'Try using individual video URLs for best results', inline: false }
                                )
                                .setFooter({ text: `Playlist ID: ${playlistId} | ${BOT_VERSION}` })
                                .setTimestamp();
                                
                            await interaction.followUp({ embeds: [embed] });
                        } catch (error) {
                            console.log('Could not send fallback embed:', error.message);
                        }
                    }, 2000);
                    return;
                } else {
                    return await interaction.editReply({
                        content: '❌ This playlist cannot be accessed. It may be private or require authentication.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
            
            if (!playlist || !playlist.items || playlist.items.length === 0) {
                return await interaction.editReply({
                    content: '❌ This playlist is empty or unavailable.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            // Send initial loading message
            await interaction.editReply({
                content: `🔄 Loading playlist: **${playlist.title}** (${playlist.items.length} videos)...`
            });
            
            let addedCount = 0;
            let startedPlaying = false;
            const videosToAdd = playlist.items.slice(0, 25); // Limit to 25 videos for performance
            
            for (const [index, item] of videosToAdd.entries()) {
                try {
                    // Skip unavailable videos
                    if (!item.id || item.title === '[Private video]' || item.title === '[Deleted video]') {
                        continue;
                    }
                    
                    const videoUrl = `https://www.youtube.com/watch?v=${item.id}`;
                    
                    // Get video info and create resource
                    const songInfo = await ytdl.getInfo(videoUrl);
                    const stream = ytdl(videoUrl, {
                        filter: 'audioonly',
                        quality: 'highestaudio',
                        highWaterMark: 1 << 25,
                        requestOptions: {
                            maxRetries: 2,
                            timeout: 8000
                        }
                    });
                    const resource = createAudioResource(stream, {inputType: StreamType.Arbitrary, inlineVolume: true});
                    
                    // Add to queue
                    player.queue.push({
                        title: songInfo.videoDetails.title,
                        resource: resource,
                        image: songInfo.videoDetails.videoId,
                        Channel: songInfo.videoDetails.author.name,
                        duration: songInfo.videoDetails.lengthSeconds,
                        url: videoUrl,
                        requestedBy: interaction.user.username
                    });
                    
                    addedCount++;
                    
                    // Start playing the first song
                    if (!startedPlaying && player.player.state.status !== AudioPlayerStatus.Playing) {
                        this.playNextInQueue(guildId);
                        startedPlaying = true;
                        
                        // Send Now Playing embed for the first song
                        setTimeout(async () => {
                            try {
                                await this.sendNowPlayingEmbed(interaction);
                            } catch (error) {
                                console.log('Error sending now playing embed:', error.message);
                            }
                        }, 1500);
                    }
                    
                    // Update progress every 5 songs
                    if (index % 5 === 0 && index > 0) {
                        try {
                            await interaction.editReply({
                                content: `🔄 Loading playlist... (${addedCount}/${videosToAdd.length} videos added)`
                            });
                        } catch (error) {
                            // Ignore editing errors
                        }
                    }
                    
                } catch (videoError) {
                    console.log(`Skipping video ${item.title}: ${videoError.message}`);
                    continue;
                }
            }
            
            // Send final playlist info as follow-up
            setTimeout(async () => {
                try {
                    const embed = new EmbedBuilder()
                        .setColor('#4285F4')
                        .setTitle('📋 Full Playlist Added!')
                        .setDescription(`**${playlist.title}**`)
                        .addFields(
                            { name: '🎵 Total Videos', value: `${addedCount} songs added to queue`, inline: true },
                            { name: '⏱️ Playlist Length', value: `${playlist.items.length} total videos`, inline: true },
                            { name: '👤 Playlist Author', value: playlist.author?.name || 'Unknown', inline: true }
                        )
                        .setThumbnail(playlist.bestThumbnail?.url || null)
                        .setFooter({ text: `Playlist ID: ${playlistId} | ${BOT_VERSION}` })
                        .setTimestamp();
                        
                    await interaction.followUp({ embeds: [embed] });
                } catch (error) {
                    console.log('Could not send playlist follow-up:', error.message);
                }
            }, 3000);
            
        } catch (error) {
            console.error('Error handling playlist:', error);
            
            // Final fallback: try to play just the video from the URL if possible
            const videoId = this.extractVideoId(url);
            if (videoId) {
                try {
                    const singleVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    await this.addSingleVideo(interaction, singleVideoUrl, false);
                    
                    await interaction.editReply({
                        content: '⚠️ Could not load the full playlist, but playing the selected video instead.'
                    });
                    return;
                } catch (fallbackError) {
                    console.log('Fallback video loading also failed:', fallbackError.message);
                }
            }
            
            await interaction.editReply({
                content: '❌ Error processing YouTube playlist. The playlist may be private, unavailable, or require authentication.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
    
    // Add a single video to the queue
    async addSingleVideo(interaction, url, skipReply = false) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);
        
        try {
            const Songinf = await ytdl.getInfo(url);
            const stream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25, 
                requestOptions: {
                    maxRetries: 3, 
                    timeout: 10000
                }
            });
            const resource = createAudioResource(stream, {inputType: StreamType.Arbitrary, inlineVolume: true});

            // Add to queue
            player.queue.push({
                title: Songinf.videoDetails.title, 
                resource: resource,
                image: Songinf.videoDetails.videoId,
                Channel: Songinf.videoDetails.author.name,
                duration: Songinf.videoDetails.lengthSeconds,
                url: url,
                requestedBy: interaction.user.username
            });
            
            // If nothing is currently playing, start playing
            if (player.player.state.status !== AudioPlayerStatus.Playing) {
                this.playNextInQueue(guildId);
                if (!skipReply) {
                    await this.sendNowPlayingEmbed(interaction);
                }
            } else if (player.player.state.status === AudioPlayerStatus.Playing && !skipReply) {
                await interaction.editReply({
                    content: `Added **${Songinf.videoDetails.title}** to the queue`
                });
            }
            
        } catch (error) {
            console.error('Error adding single video:', error);
            if (!skipReply) {
                await interaction.editReply({
                    content: '❌ Error processing the video. Please check the URL and try again.'
                });
            }
            throw error;
        }
    }

    async sendNowPlayingEmbed(interaction) {
        const guildId = interaction.guildId;
        const currentSong = this.currentlyPlaying.get(guildId);
        const Duration = Math.floor(currentSong.duration / 60) + ':' + (currentSong.duration % 60);
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setAuthor({name: "Now Playing", iconURL: "https://cdn-icons-png.flaticon.com/512/2468/2468825.png"})
            .setThumbnail(`https://i3.ytimg.com/vi/${currentSong.image}/hqdefault.jpg`)
            .addFields(
                {name: 'Title', value: `\`\`\`${currentSong.title}\n\`\`\``},
                {name: 'Duration', value: `\`\`\`${Duration}\n\`\`\``, inline:true },
                {name: 'Channel / Artist', value: `\`\`\`${currentSong.Channel}\n\`\`\``, inline: true}
            )
            .setFooter({text: `Requested By ${interaction.user.tag} | ${BOT_VERSION}`})
            .setTimestamp();

        const playbtn = new ButtonBuilder()
            .setLabel('Play in Youtube')
            .setStyle(ButtonStyle.Link)
            .setURL(currentSong.url);
        const row = new ActionRowBuilder()
            .addComponents(playbtn);

        await interaction.editReply({ embeds: [embed], components: [row] });
}
    //Checks the current player state plays the next one if not playing anything
    playNextInQueue(guildId) {
        const player = this.Player.get(guildId);

        if (!player || player.queue.length === 0) {
            // Clear currently playing when queue is empty
            if(player.currentResource){
                player.currentResource.audioPlayer = null;
                player.currentResource.encoder?.destroy();
                player.currentResource = null;
            }
            this.currentlyPlaying.delete(guildId);
            return;
        }

        const nextSong = player.queue.shift();

        if(player.currentResource){
            player.currentResource.audioPlayer = null;
            player.currentResource.encoder?.destroy();
            player.currentResource = null;
        }

        player.currentResource = nextSong.resource;
        player.player.play(nextSong.resource);

        // Update currently playing for this guild with start time
        const startTime = Date.now();
        this.currentlyPlaying.set(guildId, {
            title: nextSong.title,
            url: nextSong.url,
            image: nextSong.image,
            duration: nextSong.duration,
            Channel: nextSong.Channel,
            requestedBy: nextSong.requestedBy,
            startTime: startTime,
            isPaused: false,
            pausedAt: null,
            serverName: player.connection?.joinConfig?.guildId ? 'Server' : 'Unknown Server' // Add server info
        });
        player.player.removeAllListeners('stateChange');
        // Listen for when the song ends
        player.player.on('stateChange', (oldstate, newstate) => {
            if (newstate.status === AudioPlayerStatus.Idle) {
                this.playNextInQueue(guildId);
            }
        });
    }

    // Pause the player

    async pause(interaction) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);

        if (!player || player.player.state.status !== AudioPlayerStatus.Playing) {
            return interaction.reply({ content: 'Nothing is playing' });
        }

        player.player.pause();
        
        // Update pause state
        const currentSong = this.currentlyPlaying.get(guildId);
        if (currentSong) {
            currentSong.isPaused = true;
            currentSong.pausedAt = Date.now();
            this.currentlyPlaying.set(guildId, currentSong);
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Paused ⏸️')
                .setDescription(`${currentSong.title}`)
                .setImage(`https://media.tenor.com/WEtJpm07k9oAAAAM/music-stopped-silence.gif`)
                .setFooter({text: `Requested By ${interaction.user.tag} | ${BOT_VERSION}`})
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }

    // Resume the player

    async resume(interaction) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);

        if (!player || player.player.state.status !== AudioPlayerStatus.Paused) {
            return interaction.reply({ content: 'Nothing is paused' });
        }

        player.player.unpause();
        
        // Update resume state and adjust start time
        const currentSong = this.currentlyPlaying.get(guildId);
        if (currentSong && currentSong.isPaused) {
            const pauseDuration = Date.now() - currentSong.pausedAt;
            currentSong.startTime += pauseDuration; // Adjust start time by pause duration
            currentSong.isPaused = false;
            currentSong.pausedAt = null;
            this.currentlyPlaying.set(guildId, currentSong);
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Resumed ▶️')
                .setDescription(`${currentSong.title}`)
                .setImage(`https://y.yarn.co/da965212-e1c4-46a1-a772-e9757d322bcb_text.gif`)
                .setFooter({text: `Requested By ${interaction.user.tag} | ${BOT_VERSION}`})
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }

    // Skip the current song
    async skip(interaction) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);
        const currentSong = this.currentlyPlaying.get(guildId);

        if (!player || player.player.state.status !== AudioPlayerStatus.Playing) {
            return interaction.reply({ content: 'Nothing is playing' });
        }

        player.player.stop();
        this.playNextInQueue(guildId);

        // Send updated Now Playing embed
        if (currentSong) {
            await interaction.deferReply();
            await this.sendNowPlayingEmbed(interaction);
        } else {
            await interaction.reply({ content: 'Skipped. No more songs in the queue.' });
        }
    }

    // Stop the player
    async stop(interaction) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);
        
        if (player) {
            player.player.stop();
            player.queue = [];

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Stopped ⏹️')
                .setDescription('Music playback has been stopped')
                .setImage(`https://media.tenor.com/WEtJpm07k9oAAAAM/music-stopped-silence.gif`)
                .setFooter({text: `Requested By ${interaction.user.tag} | ${BOT_VERSION}`})
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply('No active music player.');
        }
    }

    // Queue the current song
    async queue(interaction) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);
        
        if (player && player.queue.length > 0) {
            const queueList = player.queue.map((song, index) => 
                `${index + 1}. ${song.title}`
            ).join('\n');
            
            await interaction.reply(`Current Queue 📃:\n${queueList}`);
        } else {
            await interaction.reply('The queue is empty.');
        }
    }

    // Leave the voice channel
    async leave(interaction) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);
        
        if (player) {
            player.player.stop();
            player.queue = [];
            this.currentlyPlaying.delete(guildId);

            if (player.connection) {
                player.connection.destroy();
                player.connection = null;
            }

            await interaction.reply({ embeds: [left] });
        } else {
            await interaction.reply('Not in a voice channel.');
        }
    }
}

/*Im new to using "Singleton" so im gonna leave a note of what it does.

Singleton is a design pattern that restricts the instantiation of a class to one object.
This is useful when exactly one object is needed to coordinate actions across the system.
The concept is sometimes generalized to systems that operate more efficiently when only 
one object exists, or that restrict the instantiation to a certain number of objects.*/
const musicManager = new MusicManager();

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
            {name: 'Leave', value: 'leave'}
        )
        .setRequired(true)
    )
    .addStringOption(option => 
        option.setName('url')
        .setDescription('YouTube URL (video, playlist, or mix)')
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
    musicManager: musicManager
}