const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('spotify')
    .setDescription('Displays the currently playing song on Spotify for a given user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to show the currently playing song for')
        .setRequired(false)
    ),
  async execute(interaction) {
    console.log(`[LOG] Spotify Music has been executed`);
    try{
    const { default: convert } = await import('parse-ms');
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);
    console.log(member.presence.activities);
    const status = member.presence.activities.find(activity => activity.name === 'Spotify');
    if (!status) {
      return interaction.reply(`${user} is not listening to Spotify`);
    }
    const image = `https://i.scdn.co/image/${status.assets.largeImage.slice(8)}`;
    const url = `https://open.spotify.com/search/${encodeURIComponent(status.details)}%20${encodeURIComponent(status.state)}`;
    const name = status.details;
    const artist = status.state;
    const album = status.assets.largeText;
    const duration = status.timestamps.end - status.timestamps.start;
    const timeConvert = convert(duration);

    const minutes = timeConvert.minutes < 10 ? `0${timeConvert.minutes}` : timeConvert.minutes;
    const seconds = timeConvert.seconds < 10 ? `0${timeConvert.seconds}` : timeConvert.seconds;
    const time = `${minutes}:${seconds}`;

    const embed = new EmbedBuilder()
      .setTitle('Currently Playing on Spotify')
      .setColor(0x01ED760)
      .setImage(image)
      .addFields(
        {name: 'Song', value: name},
        {name: 'Artist', value: artist, inline: true},
        {name: 'Album', value: album, inline: true},
        {name: 'Duration', value: time, inline: true},
      )
      .setFooter({text: `Requested by ${interaction.user.tag}`, avatar: [interaction.user.displayAvatarURL({ dynamic: true })]})
      .setTimestamp();

      const add = new ButtonBuilder()
      .setLabel('Play in Spotify')
      .setStyle(ButtonStyle.Link)
      .setURL(url);
      
      const row = new ActionRowBuilder()
          .addComponents(add)
      
      return interaction.reply({
          embeds: [embed],
          components: [row],
      });
  }catch (error){
    console.error(error);
  }
  },
};