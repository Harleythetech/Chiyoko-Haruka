/*******************************************************
 *            Chiyoko Haruka - V5.0 Catalyst
 *                  @Harleythetech
 * 
 *                AGPL license v3.0
 *******************************************************/

const fs = require('fs'); // File System Module
const {Client, Events, GatewayIntentBits, Collection, ActivityType, EmbedBuilder} = require('discord.js');
const {getVoiceConnection} = require('@discordjs/voice');
const client = new Client ({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], disableMentions: "all"});
const path = require('path');
const folderPath = path.join(__dirname, 'Commands');
const commandFolders = fs.readdirSync(folderPath);
const {active, bug} = require('./handlers/embed.js');
require('dotenv').config();
const sdp = require("stop-discord-phishing");


// Client Once Ready
client.on(Events.ClientReady, c => {
    console.log(`${c.user.tag} >> is now loaded and ready for use :>`);
    client.user.setActivity(client.guilds.cache.size + ' Servers', {type: ActivityType.Listening}); //Sets the bot's activity to listening to the number of servers it is in

    // Sends ON Signal to Log Channel when the bot is ready
    const logch = client.channels.cache.get(process.env.CHANNEL_ID);
    logch.send({embeds: [active]});

    // Sends a heartbeat every 30 seconds to keep the bot alive.
    heartbeat();
});

// Heartbeat: Since the bot keeps going offline, this function sends a ping every 30 seconds to keep the bot alive.
function heartbeat(){
    setInterval(()=>{
        console.log("[PING]", client.ws.ping, "Heartbeat acknowledged");
    }, 30000);
}

// Bot Command Handler.
client.commands = new Collection();

for (const folder of commandFolders){
    const cmdpath = path.join(folderPath, folder);
    const cmdfs = fs.readdirSync(cmdpath).filter(file => file.endsWith('.js'));

    for(const file of cmdfs){
        const fspath = path.join(cmdpath, file);
        const cmd = require(fspath);

        if ('data' in cmd && 'execute' in cmd){
            client.commands.set(cmd.data.name, cmd);
        }else{
            console.warn(`[WARNING - COMMAND HANDLER] The command at ${fspath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Message With Link detection and Scam Detection powered by Stop Discord Phishing
client.on(Events.MessageCreate, async message => {
    const userlink = message.content;
    const urlRegex = /((https?:\/\/|ftp:\/\/|sftp:\/\/|file:\/\/|gopher:\/\/|telnet:\/\/|nntp:\/\/|imap:\/\/|wais:\/\/|mailto:|news:|rtsp:\/\/|svn:\/\/|git:\/\/|ssh:\/\/|rsync:\/\/|www\.)[\w\-]+(\.[\w\-]+)+[#?/\w\-=&.%]*)|[\w\-]+\.[a-zA-Z]{2,}(\/[#?/\w\-=&.%]*)?/gi;
    const urlraw = userlink.match(urlRegex);
    
    if (urlraw != null) {
        for (const url of urlraw) {
            // Normalize URL if it starts with www.
            const normalizedUrl = url.startsWith('www.') ? `https://${url}` : url;
            
            const data = await sdp.checkMessage(normalizedUrl, true);
            if (data == true) {
                const embed = new EmbedBuilder()
                    .setTitle('Danger: Scam Link Detected')
                    .setDescription(`Phishing Link detected, message automatically deleted for your safety.`)
                    .setColor(0xff0000)
                    .setImage('https://media.tenor.com/ayZKpLp26ZkAAAAd/this-is-dangerous.gif');
                
                await message.channel.send({ embeds: [embed] });
                await message.delete();
            }
        }
    }
});

// Interaction Handler
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command)return;

    try{
        await command.execute(interaction);
    }catch(error){
        if (interaction.replied || interaction.deferred){
            await interaction.followUp({embeds: [bug]});
            console.error(`[BUG - INTERACTION HANDLER] ${bug}`);
        } else{
            await interaction.followUp({embeds: [bug]});
            console.error(`[ERROR - INTERACTION HANDLER] ${error}`);
        }
    }
});

// Voice State Update
client.on('voiceStateUpdate', (oldsState, newState) => {
    if (newState.member.user.bot && newState.channel === null && oldsState.channel){
        const connection = getVoiceConnection(oldsState.guild.id);

        if (connection){
            reset(); // if the bot has been disconnected for some time, reset on disconnection.
        }
    }
})

// Error on Unhandled Rejection
process.on('unhandledRejection', error => {
    console.error(`[ERROR - UNHANDLED REJECTION] ${error}`);
})

// Error on Uncaught Exception
process.on('uncaughtException', error => {
    console.error(`[ERROR - UNCAUGHT EXCEPTION] ${error}`);
})

//Bot Login
client.login(process.env.token);