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
        const response = await fetch('https://some-random-api.com/animal/bird');
        const data = (await response.json());

        const fact = data.fact;
        const img = data.image;

        const embed = new EmbedBuilder()
        .setTitle('Bird Facts!')
        .setDescription(fact)
        .setImage(img)
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