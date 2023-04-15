const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports ={
    data: new SlashCommandBuilder()
    .setName('ily-confession')
    .setDescription(`what? are you really that desperate?`),
    async execute(interaction){
        console.log(`[LOG] ily-confession has been executed`);
        try{
        const uname = interaction.user.username;
        const ily = new EmbedBuilder()
        .setTitle(`Get Rejected!`)
        .setDescription(`${uname} I Don't Love you.`)
        .setColor(0x0099ff)
        .setImage(`https://c.tenor.com/HYvhvbB4QmYAAAAC/blegh-hahaha.gif`)
        .setTimestamp()
        .setFooter({text: `Time Rejected`})
        return interaction.reply({embeds: [ily]})
        }catch (error){
            console.error(error)
        }
    }
}