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
        const api = await fetch('https://some-random-api.com/animal/koala');
        const response = (await api.json());

        const fact = response.fact;
        const image = response.image;

        const embed = new EmbedBuilder()
        .setTitle('Koala Facts!')
        .setDescription(fact)
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