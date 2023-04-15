const fs = require('fs');
const {Client, Events, GatewayIntentBits, Collection} = require('discord.js');
const client = new Client ({intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences],  disableMentions: "all" });
require('dotenv').config();
const path = require ('path');
const folderPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(folderPath);
const {active, bug}= require ('./handlers/embed.js')


client.on(Events.ClientReady, c => {
    console.log(`${c.user.tag} >> System is now loaded and is ready to have fun!`);
    client.user.setActivity("JS: v.0.1.ch1r.canary", {type: "PLAYING"});
    const logch = client.channels.cache.get(process.env.chid);
    logch.send({embeds: [active]});
});


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
			await interaction.followUp({ content: 'There was an error while executing this command!'});
            console.log(error);
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!'});
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