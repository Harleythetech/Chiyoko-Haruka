const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const {bug} = require('../../handlers/embed.js');
module.exports = {
    data: new SlashCommandBuilder()
    .setName('koala-facts')
    .setDescription('sends a random koala image with facts'),

    async execute(interaction){
        try{
        console.log(`[LOG] koala Facts has been triggered`)
        const {default: fetch} = await import('node-fetch');
        const res = await fetch('https://some-random-api.ml/img/koala');
        const fact = await fetch('https://some-random-api.ml/facts/koala');
        const faact = (await fact.json()).fact;
        const image = (await res.json()).link;
        const embed = new EmbedBuilder()
        .setTitle('Koala Facts!')
        .setDescription(faact)
        .setImage(image)
        .setFooter({text: `Requested by ${interaction.user.tag}`})
        .setTimestamp()
        .setColor(0x22e4cc);
        return interaction.reply({embeds: [embed]})
        }catch (error){
            console.error(`[ERROR] ${error}`)
            return interaction.reply({embeds: [bug]})
        }
    }
}