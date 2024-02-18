const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const {toomuch, notlistening} = require('../../handlers/embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playcheck')
    .setDescription('Displays the information of track playing')
    .addStringOption(option =>
        option.setName('type')
        .setDescription('What Status Type to check')
        .addChoices(
            {name: 'Spotify', value: '2'},
            {name: 'MusicBee / Foobar2000', value: '0'}
        )
        .setRequired(true)
    )
    .addUserOption(option =>
        option.setName('user')
          .setDescription('want to know what they are listening')
          .setRequired(false),
    ),
        async execute(interaction){
            console.log(`[LOG] Media Check has been executed`);
            try{
                const user = interaction.options.getUser('user') || interaction.user;
                const PlaybackType = interaction.options.getString('type');
                const member = interaction.guild.members.cache.get(user.id);
                

                const media = member.presence.activities.find((activity => activity.name === 'Spotify'));
                const unimedia = member.presence.activities.find((activity => activity.type == 0));
                console.log(media || unimedia);
                console.log(PlaybackType);
                //MusicBee
                if(PlaybackType == '2' && media != undefined){
                const { default: convert } = await import('parse-ms');
                const simage = `https://i.scdn.co/image/${media.assets.largeImage.slice(8)}`;
                const surl = `https://open.spotify.com/search/${encodeURIComponent(media.details)}%20${encodeURIComponent(media.state)}`;
                const sname = media.details;
                const sartist = media.state;
                const salbum = media.assets.largeText;
                const duration = media.timestamps.end - media.timestamps.start;
                const timeConvert = convert(duration);

                const minutes = timeConvert.minutes < 10 ? `0${timeConvert.minutes}` : timeConvert.minutes;
                const seconds = timeConvert.seconds < 10 ? `0${timeConvert.seconds}` : timeConvert.seconds;
                const stime = `${minutes}:${seconds}`;

                const sembed = new EmbedBuilder()
                .setTitle('Currently Playing on Spotify')
                .setColor(0x01ED760)
                .setImage(simage)
                .addFields(
                    {name: 'Song', value: sname},
                    {name: 'Artist', value: sartist, inline: true},
                    {name: 'Album', value: salbum, inline: true},
                    {name: 'Duration', value: stime, inline: true},
                )
                .setFooter({text: `Requested by ${interaction.user.tag}`})
                .setTimestamp();

                const add = new ButtonBuilder()
                .setLabel('Play in Spotify')
                .setStyle(ButtonStyle.Link)
                .setURL(surl);
      
                const row = new ActionRowBuilder()
                    .addComponents(add)
      
                return interaction.reply({
                    embeds: [sembed],
                    components: [row],
                });
            }else if (PlaybackType == '0' && unimedia != undefined){
                const mimage  = `https://${unimedia.assets.largeImage?.split('https/')[1]}`;
                console.log(mimage);

                const aa = unimedia.details || "Undefined";
                const fsong = unimedia.state || "Undefined";
                const furl = `https://open.spotify.com/search/${encodeURIComponent(fsong)}`;

                const fembed = new EmbedBuilder()

                .setTitle(`Currently Playing on ${unimedia.name || "Undefined"}`)
                .setColor(0xffbf00)
                .addFields(
                    {name: 'Song', value: fsong}, 
                    {name: 'Artist/Album', value: aa},
                )
                .setFooter({text: `Requested by ${interaction.user.tag}`})
                .setTimestamp()
                .setImage('https://i.gyazo.com/4e7a4b6834400626ecf0a45d370e1f20.png')
                
                if(mimage === 'https://undefined'){
                    fembed.setImage('https://i.gyazo.com/4e7a4b6834400626ecf0a45d370e1f20.png');
                    fembed.setDescription(`Warning: Image for the said track is currently unavailable`);
                }else{
                    fembed.setImage(mimage);
                }
                
                const btn = new ButtonBuilder()
                .setLabel('Play in Spotify')
                .setStyle(ButtonStyle.Link)
                .setURL(furl);
                
                const row = new ActionRowBuilder()
                .addComponents(btn)

                return interaction.reply({
                    embeds: [fembed],
                    components: [row]

                });
            }else {
                return interaction.reply({embeds: [notlistening]});
            }

            }catch(error){
                console.error(`[Error] Command Overload: Two or more services detected, Bot Can only handle one at a time. ${error}`);
                return interaction.reply({embeds: [toomuch]});
            }
        }
}