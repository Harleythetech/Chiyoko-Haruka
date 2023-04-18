const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const {bug} = require('../../handlers/embed.js');
module.exports = {
    data: new SlashCommandBuilder()
    .setName('shibe-img')
    .setDescription('sends a random shibe image'),

    async execute(interaction){
        try{
        console.log(`[LOG] shibe image has been triggered`)
        const {default: fetch} = await import('node-fetch');
        const res = await fetch('http://shibe.online/api/shibes');
        const image = (await res.json())[0];
        const embed = new EmbedBuilder()
        .setTitle('Look a Shibe!')
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