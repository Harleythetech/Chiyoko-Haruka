const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const config = require(`../../handlers/config.json`)

module.exports = {
    data: new SlashCommandBuilder()
    .setName(`introduction`)
    .setDescription(`Bot\'s Introduction`),
    async execute(interaction){
        console.log(`[LOG] Info-Check has been executed`);
        try{
        const uname = interaction.user.username;
        const intro = new EmbedBuilder()
        .setTitle(config.BOT_NAME)
        .setDescription(`Hello ${uname} I\'m ${config.BOT_NAME}\, My Prefix is "/" and i\'m currently under development so please have patience in me\, If you need any help my creator **Harleyyyu** will be happy to assist you with any concerns you have\, Thank you for testing me out!`)
        .setImage(`https://i.imgur.com/mwOFCBO.png`)
        .setTimestamp()
        .setFooter({text: `${config.BOT_NAME} \: ${config.BOT_VERSION}`})
        return interaction.reply({embeds: [intro]})
        }catch(error){
            console.error(error);
        }
    }
}