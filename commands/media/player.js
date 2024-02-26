const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const {bug, failedtoplay, notoncall, left} = require('../../handlers/embed.js');
const ytdl = require('ytdl-core');
const { createAudioPlayer, generateDependencyReport, createAudioResource, StreamType, joinVoiceChannel, getVoiceConnection, AudioPlayerStatus, AudioPlayer } = require('@discordjs/voice');
const player = createAudioPlayer();
const BOT_VERSION = 'V0.4.S.NightByte';


module.exports = {
    data: new SlashCommandBuilder()
    .setName('music-player')
    .setDescription('Play Music from Youtube Library')
    .addStringOption(option =>
        option.setName('player-menu')
        .setDescription('Display Commands for player')
        .addChoices(
            {name: 'Play', value: 'play'},
            {name: 'Pause', value: 'pause'},
            {name: 'Resume', value: 'resume'},
            {name: 'Stop', value: 'stop'},
            {name: 'Disconnect', value: 'disconnect'}
        )
        .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('url')
        .setDescription('Enter Youtube URL or Search Query to play')
        .setRequired(false)
    ),

    async execute(interaction) {
        try{
        console.log('[LOG] Music Player has been executed');
        const player = interaction.options.getString('player-menu');
        const url = interaction.options.getString('url');
        console.log(`Selected Value: ${player} \nURL Entered: ${url}`);
        
        //console.log(generateDependencyReport());
      
        if(!interaction.member.voice.channel){
            return interaction.reply({embeds: [notoncall], ephemeral: true});
        };

        switch (player){
            case 'play':
                await playSong(interaction, url);
                break; 
            case 'disconnect':
                await dc(interaction);
                break;
            case 'pause':
                await pause(interaction);
                break;
            case 'resume':
                await resume(interaction);
                break;
            case 'stop':
                await stop(interaction);
                break;
            
        };
        }catch(error){
            console.error(error);
            return interaction.reply({embeds: [notoncall], ephemeral: true});
        }
      }
      
}

// PLay Music
const queue = [];
let isPlaying = false;

// PLay Music
async function playSong(interaction, url){
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
        return interaction.reply({ content: 'You must be in a voice channel to use this command.', ephemeral: true });
    }
        
    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });
        
        if (!isPlaying && queue.length === 0) {
            // If not currently playing and queue is empty, play the requested song
            await queue.push(url);
            await interaction.deferReply();
            await playUrl(interaction, url, connection);
            await console.log(queue);
            isPlaying = true;
        } else {
            // Add the requested song to the queue
            await interaction.deferReply({ephemeral: true});
            await queue.push(url);
            await console.log(queue);
            const ytinf = await ytdl.getInfo(url);
            const min = Math.floor(ytinf.videoDetails.lengthSeconds / 60) + ':' + (ytinf.videoDetails.lengthSeconds % 60);
            const add = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`Added to Queue 🎶`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2468/2468825.png')
                .setImage(`https://img.youtube.com/vi/${ytdl.getVideoID(url)}/maxresdefault.jpg`)
                .addFields(
                    { name: 'Title', value: `\`${ytinf.videoDetails.title}\`` },
                    { name: 'Duration', value: `\`${min}\``, inline: true },
                    { name: 'Channel', value: `\`${ytinf.videoDetails.author.name}\``, inline: true },
                )
                .setFooter({text: `Requested by ${interaction.user.tag}`})
                .setTimestamp();
        
            const playbtn = new ButtonBuilder()
                .setLabel('Play in Youtube')
                .setStyle(ButtonStyle.Link)
                .setURL(url);
            const row = new ActionRowBuilder()
                .addComponents(playbtn);
        

            await interaction.editReply({embeds: [add], components: [row]});
        }
    } catch (error) {
        console.error('Error playing song:', error);
        await interaction.editReply({embed: failedtoplay, ephemeral: true});
    }
}

// Play URL function
async function playUrl(interaction, url, connection) {
    const yt = ytdl(queue[0], {filter: 'audioonly', quality: 'highestaudio'});
    const resource = createAudioResource(yt, { inputType: StreamType.Arbitrary });
    player.play(resource);
    await connection.subscribe(player);

    const ytinf = await ytdl.getInfo(queue[0]);
    const min = Math.floor(ytinf.videoDetails.lengthSeconds / 60) + ':' + (ytinf.videoDetails.lengthSeconds % 60);
    const playing = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Currently Playing 🎶`)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2468/2468825.png')
        .setImage(`https://img.youtube.com/vi/${ytdl.getVideoID(queue[0])}/maxresdefault.jpg`)
        .addFields(
            { name: 'Title', value: `\`${ytinf.videoDetails.title}\`` },
            { name: 'Duration', value: `\`${min}\``, inline: true },
            { name: 'Channel', value: `\`${ytinf.videoDetails.author.name}\``, inline: true },
        )
        .setFooter({text: `Requested by ${interaction.user.tag}`})
        .setTimestamp();

    const playbtn = new ButtonBuilder()
        .setLabel('Play in Youtube')
        .setStyle(ButtonStyle.Link)
        .setURL(queue[0]);
    const row = new ActionRowBuilder()
        .addComponents(playbtn);

    await interaction.editReply({embeds: [playing], components: [row]});
    await console.log (`[LOG] Playing ${ytinf.videoDetails.title} from ${ytinf.videoDetails.author.name}`);

    player.on(AudioPlayerStatus.Idle, async () => {
        if (queue.length > 0) {
            const nextUrl = await queue.shift();
            await playUrl(interaction, nextUrl, connection);
        }
        else {
            isPlaying = false;
        }
    });
}




//Disconnect Bot to Voice Channel
async function dc(interaction){
    try{
    await interaction.deferReply({ephemeral: true});
    const voiceChannel = interaction.member.voice.channel;
    const connection = getVoiceConnection(voiceChannel.guild.id);
    if (connection) {
        queue.length = 0;
        isPlaying = false;
        connection.destroy();
        await interaction.editReply({embeds: [left]});
    }else{
        await interaction.editReply({embeds: [notoncall]});
    }
    }catch(error){
        console.error(error);
        await interaction.editReply({embed:bug, ephemeral: true});
    }
}

// Pause Music
async function pause(interaction){
    try{
    await interaction.deferReply({ephemeral: true});
    const voiceChannel = interaction.member.voice.channel;
    const connection = getVoiceConnection(voiceChannel.guild.id);
    player.pause();
    connection.subscribe(player);
    const pau = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Beep Boop...`)
        .setDescription(`${interaction.user.tag} Paused Music`)
        .setImage('https://media1.tenor.com/m/XTl1q0gJIF8AAAAd/tsurezure-children-put-phone-down.gif')
        .setTimestamp()
        .setFooter({text: BOT_VERSION});
    await interaction.editReply({embeds: [pau]});
    }catch(error){
        console.error('Error playing song:', error);
        await interaction.editReply({embed: bug, ephemeral: true});
    }
}

async function resume(interaction){
    try{
    await interaction.deferReply({ephemeral: true});
    const voiceChannel = interaction.member.voice.channel;
    const connection = getVoiceConnection(voiceChannel.guild.id);
    player.unpause();
    connection.subscribe(player);
    const tap = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Beep Boop...`)
        .setDescription(`${interaction.user.tag} resumed the music`)
        .setImage('https://media1.tenor.com/m/d_IO8M1rCD0AAAAC/listening-to-music-jerry.gif')
        .setTimestamp()
        .setFooter({text: BOT_VERSION});
    await interaction.editReply({embeds: [tap]});
    }catch(error){
        console.error('Error playing song:', error);
        await interaction.editReply({embed: failedtoplay, ephemeral: true});
    }
}

async function stop(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const voiceChannel = interaction.member.voice.channel;
        const connection = getVoiceConnection(voiceChannel.guild.id);
        
        // Stop the player
        await player.stop();
        // Ensure player is subscribed to the connection
        await connection.subscribe(player);

        // Edit the reply to indicate that the music has stopped
        const tap = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`Beep Boop...`)
            .setDescription(`${interaction.user.tag} Stopped the music`)
            .setImage('https://media1.tenor.com/m/1NTLzvJ1yQ8AAAAC/michael-jordan-stop-it.gif')
            .setTimestamp()
            .setFooter({ text: BOT_VERSION });

        await interaction.editReply({ embeds: [tap] });
    } catch (error) {
        console.error('Error stopping music:', error);
        await interaction.editReply({ embed: bug, ephemeral: true });
    }
}
