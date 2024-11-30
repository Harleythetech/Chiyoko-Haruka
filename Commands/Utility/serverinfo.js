const { SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const config = require('../../handlers/config.json')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('server-info')
		.setDescription('Provides information about the server.'),
	async execute(interaction) {
		// interaction.guild is the object representing the Guild in which the command was run
        try{
			const server = new EmbedBuilder()
			.setTitle(`Server Check`)
			.setDescription('Gives you the information of what server you are in.')
			.addFields(
				{name: 'Server Name', value: interaction.guild.name},
				{name: 'Amount of members', value: interaction.guild.memberCount.toString(), inline: true},
				{name: 'Creation Date', value: interaction.guild.createdAt.toDateString(), inline: true},
			)
			.setImage(interaction.guild.iconURL())
			.setFooter({text: config.BOT_NAME + ':' + config.BOT_VERSION});

		await interaction.reply({embeds: [server]});
		}catch(error){
			console.error(error);
		}
	},
};