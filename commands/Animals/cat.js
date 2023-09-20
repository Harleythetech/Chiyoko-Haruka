const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const {bug} = require('../../handlers/embed.js');
module.exports = {
    data: new SlashCommandBuilder()
    .setName('cat-facts')
    .setDescription('sends a random cat image with facts'),

    async execute(interaction){
        try{
        console.log(`[LOG] cat Facts has been triggered`)
        const {default: fetch} = await import('node-fetch');
        const response = await fetch('https://some-random-api.com/animal/cat');
        const Data = await response.json();
  
        const image = Data.image;
        const fact = Data.fact;
  
        const embed = new EmbedBuilder()
        .setTitle('Cat Facts!')
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