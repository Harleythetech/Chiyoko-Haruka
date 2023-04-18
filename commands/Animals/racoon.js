const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const {bug} = require('../../handlers/embed.js');
module.exports = {
    data: new SlashCommandBuilder()
    .setName('racoon-facts')
    .setDescription('sends a random racoon image with facts'),

    async execute(interaction){
        try{
        console.log(`[LOG] racoon Facts has been triggered`)
        const {default: fetch} = await import('node-fetch');
        const res = await fetch('https://some-random-api.ml/animal/raccoon');
        const fact = await fetch('https://some-random-api.ml/animal/kangaroo');
        const faact = (await fact.json()).fact;
        const image = (await res.json()).image;
        const embed = new EmbedBuilder()
        .setTitle('Racoon Facts!')
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