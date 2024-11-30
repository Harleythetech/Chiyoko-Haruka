const {Client, Collection, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const {bug, failedtoplay, notoncall, left} = require('../../handlers/embed.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, getVoiceConnection, AudioPlayerStatus, StreamType} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const {BOT_VERSION} = require('../../handlers/config.json');

class MusicManager{
    constructor(){
        this.Player = new Map();
        this.currentlyPlaying = new Map();
    }

    async play (interaction){
        const guildId = interaction.guildId;
        const voicech = interaction.member.voice.channel;

        //Server Specific Player
        if(!this.Player.has(guildId)){
            this.Player.set(guildId, {
                connection: null,
                player: createAudioPlayer(),
                queue: [],
                state: null
            });
        }
        const player = this.Player.get(guildId);

        // Check if user is in a voice channel
        if(!voicech){
            return interaction.reply({embeds: [notoncall]});
        }
        
        //Create Voice Connection
        if(!player.connection){
            player.connection = joinVoiceChannel({
                channelId: voicech.id,
                guildId: guildId,
                adapterCreator: voicech.guild.voiceAdapterCreator
            });
            player.connection.subscribe(player.player);
        }

        //Get URL and add to queue
        const url = interaction.options.getString('url');
        try{
            const Songinf = await ytdl.getInfo(url);
            const stream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25, 
                requestOptions: {
                    maxRetries: 3, 
                    timeout: 10000}
                });
            const resource = createAudioResource(stream,{inputType: StreamType.Arbitrary, inlineVolume: true});

            //add to queue
            player.queue.push({
                title: Songinf.videoDetails.title, 
                resource: resource,
                image: Songinf.videoDetails.videoId,
                Channel: Songinf.videoDetails.author.name,
                duration: Songinf.videoDetails.lengthSeconds,
                url: url,
                requestedBy: interaction.user.username
            });

            //if nothing is currently playing start playing
            if (player.player.state.status !== AudioPlayerStatus.Playing) {
                this.playNextInQueue(guildId);
                await this.sendNowPlayingEmbed(interaction);
            } else {
                await interaction.reply({
                    content: `Added ${Songinf.videoDetails.title} to the queue`
                });
            }

        }catch(error){
            console.error(error);
            return interaction.reply({embeds: [bug]});
        }
    }

    async sendNowPlayingEmbed(interaction) {
        const guildId = interaction.guildId;
        const currentSong = this.currentlyPlaying.get(guildId);

        if (currentSong) {
            const Duration = Math.floor(currentSong.duration / 60) + ':' + (currentSong.duration % 60);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setAuthor({name: "Now Playing", iconURL: "https://cdn-icons-png.flaticon.com/512/2468/2468825.png"})
                .setImage(`https://img.youtube.com/vi/${currentSong.image}/maxresdefault.jpg`)
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

            await interaction.channel.send({ embeds: [embed], components: [row] });
        }
    }
    //Checks the current player state plays the next one if not playing anything
    playNextInQueue(guildId) {
        const player = this.Player.get(guildId);

        if (!player || player.queue.length === 0) {
            // Clear currently playing when queue is empty
            this.currentlyPlaying.delete(guildId);
            return;
        }

        const nextSong = player.queue.shift();
        player.player.play(nextSong.resource);

        // Update currently playing for this guild
        this.currentlyPlaying.set(guildId, {
            title: nextSong.title,
            url: nextSong.url,
            image: nextSong.image,
            duration: nextSong.duration,
            Channel: nextSong.Channel,
            requestedBy: nextSong.requestedBy
        });

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
        
        const currentSong = this.currentlyPlaying.get(guildId);
        if (currentSong) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Paused')
                .setDescription(`[${currentSong.title}](${currentSong.url})`)
                .addFields(
                    { name: 'Requested By', value: currentSong.requestedBy }
                )
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
        
        const currentSong = this.currentlyPlaying.get(guildId);
        if (currentSong) {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Resumed')
                .setDescription(`[${currentSong.title}](${currentSong.url})`)
                .addFields(
                    { name: 'Requested By', value: currentSong.requestedBy }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }

    // Skip the current song
    async skip(interaction) {
        const guildId = interaction.guildId;
        const player = this.Player.get(guildId);

        if (!player || player.player.state.status !== AudioPlayerStatus.Playing) {
            return interaction.reply({ content: 'Nothing is playing' });
        }

        player.player.stop();
        this.playNextInQueue(guildId);

        // Send updated Now Playing embed
        await this.sendNowPlayingEmbed(interaction);
        
        return interaction.reply({ content: 'Skipped to the next song' });
    }

    // Stop the player
    async stop(interaction) {
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

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Stopped')
                .setDescription('Music playback has been stopped')
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
            
            await interaction.reply(`Current Queue:\n${queueList}`);
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

            await interaction.reply({ content: 'Left the voice channel' });
        } else {
            await interaction.reply('Not in a voice channel.');
        }
    }
}

const musicManager = new MusicManager();

module.exports = {
    data: new SlashCommandBuilder()
    .setName('play-music')
    .setDescription('Play music (only youtube is currently supported)')
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
        .setDescription('Enter a youtube url or search query')
        .setRequired(false)
    ),

    async execute (interaction){
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
    }
}