const fs = require('fs');
const {Client, Events, GatewayIntentBits, Collection, ActivityType} = require('discord.js');
const {getVoiceConnection} = require('@discordjs/voice');
const client = new Client ({intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages],  disableMentions: "all" });
require('dotenv').config();
const path = require ('path');
const folderPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(folderPath);
const {active, bug}= require ('./handlers/embed.js')
const twitch = require('./Stream/Twitch.js');
const youtube = require('./Stream/Youtube.js');
const ver = require('./handlers/config.json');

let status =[
    {
        name: 'with Discord API',
        type: 'PLAYING'
    },
    {
        name: client.guilds.cache.size + ' servers',
        type: 'WATCHING'
    },
    {
        name: 'Version ' + ver.BOT_VERSION,
        type: 'PLAYING'
    },
    {
        name: 'Creator Might be Streaming',
        type: 'STREAMING',
        url: 'https://www.twitch.tv/Harleyyu_'
    }

]

client.on(Events.ClientReady, c => {
    console.log(`${c.user.tag} >> System is now loaded and is ready to have fun!`);

    setInterval(() => {
        const random = status[Math.floor(Math.random() * status.length)];
        client.user.setActivity(random.name, {type: random.type, url: random.url});
        console.log(`[Status] ${random.type} ${random.name}`);
    }, 40000);

    const logch = client.channels.cache.get(process.env.chid);
    logch.send({embeds: [active]});
    heartbeat();
});
client.on('voiceStateUpdate', (oldState, newState) => {
    // Check if the user is a bot and if the bot was disconnected
    if (newState.member.user.bot && newState.channel === null && oldState.channel) {
        const connection = getVoiceConnection(oldState.guild.id);
        if (connection) {
            // Bot has been disconnected from the voice channel
            reset(); // Reset data on disconnection
        }
    }
});
function heartbeat(){
    setInterval(()=> {
        console.log("[Ping]", client.ws.ping, "Makeshift Heartbeat acknowledged");
    },30000);
}

client.commands = new Collection();
for (const folder of commandFolders){
    const commandsPath = path.join(folderPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles){
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if('data' in command && 'execute' in command){
            client.commands.set(command.data.name, command);
        }else{
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
        }
    }
}



client.on(Events.InteractionCreate, async interaction =>{
    if(!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if(!command) return;
    try{
        await command.execute(interaction);

    }catch(error){
        if (interaction.replied || interaction.deferred) {
			await interaction.followUp({embeds: [bug]});
            console.log(error);
		} else {
			await interaction.followUp({embeds: [bug]});
            console.log(error);
		}
    }
});
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
  });
  
  process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
  });

client.login(process.env.TOKEN);