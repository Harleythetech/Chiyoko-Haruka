const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../handlers/config.json')
module.exports = {
    data: new SlashCommandBuilder()
    .setName('invite-bot')
    .setDescription('Invites the bot to your server!'),

    async execute(interaction){
        console.log(`[LOG] Info-Check has been executed`);
        try{
        const inv = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Invite')
        .setDescription('I\'m greateful that you like my work!\, Press the button below to invite me to your server!')
        .setImage(`https://i.imgur.com/mwOFCBO.png`)
        .setFooter({text: `${config.BOT_NAME} \: ${config.BOT_VERSION}`})

        const add = new ButtonBuilder()
        .setLabel('Add To Server!')
        .setStyle(ButtonStyle.Link)
        .setURL(config.INVLINK);
        
        const row = new ActionRowBuilder()
            .addComponents(add)
        
        return interaction.reply({
            embeds: [inv],
            components: [row],
        });
    }catch(error){
        console.log(error);
    }
    }
}