const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const config = require(`../../handlers/config.json`)

module.exports = {
    data: new SlashCommandBuilder()
    .setName(`introduction`)
    .setDescription(`Bot\'s Introduction`),
    async execute(interaction){
        console.log(`[LOG] Bot Introduction has been executed`);
        try{
        const uname = interaction.user.username;
        const intro = new EmbedBuilder()
        .setTitle(config.BOT_NAME)
        .setDescription(`Hello ${uname} I\'m ${config.BOT_NAME}\, My Prefix is "/" and i\'m currently under development so please have patience in me\, If you need any help my creator **Harleyyyu** will be happy to assist you with any concerns you have\, Thank you for testing me out!`)
        .setImage(`https://i.imgur.com/mwOFCBO.png`)
        .setTimestamp()
        .setFooter({text: `${config.BOT_NAME} \: ${config.BOT_VERSION}`})

        const proj = new ButtonBuilder()
        .setLabel('Github Project')
        .setStyle(ButtonStyle.Link)
        .setURL(config.INVLINK);

        const add = new ButtonBuilder()
        .setLabel('Report Issues here!')
        .setStyle(ButtonStyle.Link)
        .setURL(config.GITHUB_ISSUES);
        
        const row = new ActionRowBuilder()
            .addComponents(proj)
            .addComponents(add)

        return interaction.reply({embeds: [intro], components:[row]})
        }catch(error){
            console.error(error);
        }
    }
}