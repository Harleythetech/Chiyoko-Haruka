const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const {bug} = require('../../handlers/embed.js');
module.exports = {
    data: new SlashCommandBuilder()
    .setName('bird-facts')
    .setDescription('sends a random bird image with facts'),

    async execute(interaction){
        try{
        console.log(`[LOG] Bird Facts has been triggered`)
        const {default: fetch} = await import('node-fetch');
        const res = await fetch('http://shibe.online/api/birds');
        const fact = await fetch('https://some-random-api.ml/facts/bird');
        const faact = (await fact.json()).fact;
        const image = (await res.json())[0];
        const embed = new EmbedBuilder()
        .setTitle('Bird Facts!')
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