const { SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const config = require ('../../handlers/config.json')
const {bug} = require('../../handlers/embed.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Check Latency and API Latency'),
    async execute(interaction){
        // Ping Embed
        try{
        const ping = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`🏓ping pong`)
        .setDescription(`**Server: ** Local Server (Private) \n**Latency: **${Date.now() - interaction.createdTimestamp}ms \n**API:** ${Math.round(interaction.client.ws.ping)}ms`)
        .setImage('https://media2.giphy.com/media/ECwTCTrHPVqKI/giphy.gif?cid=ecf05e47pyut03gtv3uo3ok10nosqd106gdwct60ptftxw51&rid=giphy.gif&ct=g')
        .setTimestamp()
        .setFooter({text: config.BOT_NAME + ':' + config.BOT_VERSION});
        const data = (`Latency: ${Date.now() - interaction.createdTimestamp}ms\nAPI Latency: ${Math.round(interaction.client.ws.ping)}ms`);
                return interaction.reply({embeds: [ping]});
        global.reportLog(data, `Ping`, `Utility`);
        }catch(error){
          await interaction.reply({embeds: [bug]});
          global.reportError(error, `Ping`, `Utility`);
        }
    }
};