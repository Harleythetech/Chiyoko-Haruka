const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const {bug} = require('../../handlers/embed.js');
const config = require('../../handlers/config.json')

module.exports = {
    data: new SlashCommandBuilder()
    .setName(`user-info`)
    .setDescription(`Check\'s user information`)
    .addUserOption(option =>
        option.setName(`user`)
        .setDescription(`Select a User`)
        ),
    
    async execute(interaction){
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
            .setFooter({text: `${config.BOT_NAME} \: ${config.BOT_VERSION}`})
            .setTimestamp();
            
            return interaction.reply({embeds: [embed]});
        }catch (error){
            await interaction.reply({embeds: [bug]});
            global.reportError(error, `Introduction`, `Utility`);
        }
    },
};