const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName(`user-check`)
    .setDescription(`Check\'s user information`)
    .addUserOption(option =>
        option.setName(`user`)
        .setDescription(`Select a User`)
        ),
    
    async execute(interaction){
        console.log(`[LOG] UserInfo has been executed`);
        try{
        const user = interaction.options.getUser('user') || interaction.user;
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`${user.username}'s Information`)
            .setImage(user.displayAvatarURL())
            .addFields(
                { name: 'Username', value: user.username, inline: true },
                { name: 'Discriminator', value: `#${user.discriminator}`, inline: true },
                { name: 'ID', value: user.id, inline: true },
                { name: 'Account Creation Date', value: user.createdAt.toLocaleDateString('en-US', { timeZone: 'UTC' }), inline: true }
            )
            .setTimestamp();
            
            return interaction.reply({embeds: [embed]});
        }catch (error){
            console.log(error);
        }
    },
};