//required files
const fs = require('fs');
const {Discord, Collection, GatewayIntentBits} = require('discord.js');
const config = require('./handlers/config.json');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ascii = require('ascii-table');
const path = require('node:path')
require('dotenv').config();

//Client Login
client.on("ready", ()=>{
    client.user.setActivity("JS: v.0.1.ch1r.canary", {type: "PLAYING"});
    console.log('Chikyoko Haruka> Bot is up and Running');
    const logch = client.channels.cache.get(process.env.channelid);
	logch.send('beep boop... Chiyoko Haruka is now active!');
});

//Client Start
client.login(process.env.TOKEN);

//command handler
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles){
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
};
