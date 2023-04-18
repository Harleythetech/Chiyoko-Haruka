const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const {toomuch} = require('../../handlers/embed.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playcheck')
    .setDescription('Displays the information of track playing')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('want to know what they are listening')
        .setRequired(false)
    ),
        async execute(interaction){
            console.log(`[LOG] Media Check has been executed`);
            try{
                const user = interaction.options.getUser('user') || interaction.user;
                const member = interaction.guild.members.cache.get(user.id);
                console.log(member.presence.activities);

                const media = member.presence.activities.find(activity => activity.name === 'MusicBee' || activity.name === 'Spotify' || activity.name === 'foobar2000');
                //MusicBee
                if(!media){
                    return interaction.reply(`${user} is not listening to any of the supported services`);
                }else if(member.presence.activities.find(activity => activity.name === 'MusicBee')){
                const mimage  = `https://${media.assets.largeImage?.split('https/')[1]}`;
                console.log(`[Debug] link:  ${mimage}`)
                const aa = media.details;
                const [martist, malbum] = aa.split(' - ');
                const murl = `https://open.spotify.com/search/${encodeURIComponent(media.state)}%20${encodeURIComponent(martist)}`;
                const msong = media.state;
                const membed = new EmbedBuilder()
                .setTitle('Currently Playing on MusicBee')
                .setColor(0xffbf00)
                .addFields(
                    {name: 'Song', value: msong, inline: true}, 
                    {name: 'Artist', value: martist, inline: true},
                    {name: 'Album', value: malbum, inline: true},
                )
                .setFooter({text: `Requested by ${interaction.user.tag}`})
                .setTimestamp()
                .setImage('https://i.gyazo.com/4e7a4b6834400626ecf0a45d370e1f20.png')
                
                if(mimage === 'https://undefined'){
                    membed.setImage('https://i.gyazo.com/4e7a4b6834400626ecf0a45d370e1f20.png');
                    membed.setDescription(`Image for the said track is currently unavailable`);
                }else{
                    membed.setImage(mimage);
                }

                const btn = new ButtonBuilder()
                .setLabel('Play in Spotify')
                .setStyle(ButtonStyle.Link)
                .setURL(murl);
                
                const row = new ActionRowBuilder()
                .addComponents(btn)

                return interaction.reply({
                    embeds: [membed],
                    components: [row]

                });
            }else if(member.presence.activities.find(activity => activity.name === 'Spotify')){
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
            }else if(member.presence.activities.find(activity => activity.name === 'foobar2000')){
                const aa = media.details;
                const furl = `https://open.spotify.com/search/${encodeURIComponent(aa)}`;
                const fsong = media.state;
                const fembed = new EmbedBuilder()
                .setTitle('Currently Playing on foobar2000')
                .setColor(0xffbf00)
                .addFields(
                    {name: 'Song', value: fsong}, 
                    {name: 'Artist/Album', value: aa},
                )
                .setFooter({text: `Requested by ${interaction.user.tag}`})
                .setTimestamp()
                
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
            }

            }catch(error){
                console.error(`[Error] Command Overload: Two or more services detected, Bot Can only handle one at a time.`);
                return interaction.reply({embeds: [toomuch]});
            }
        }
}