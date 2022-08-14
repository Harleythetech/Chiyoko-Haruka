const Discord = require('discord.js');
const convert = require('parse-ms');
const config = require('../handlers/config.json');


module.exports = {
    name: "spotify",
    category: "Utility",
    description: 'Gives the info of the song in which the mentioned user is litening to spotify',

   run: async function (client, message, args)  {
    
        const user = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;

        let status;
        if (user.presence.activities.length === 1) status = user.presence.activities[0];
        else if (user.presence.activities.length > 1) status = user.presence.activities[1];

        if (user.presence.activities.length === 0 || status.name !== "Spotify" && status.type !== "LISTENING") {
            const spotifyerr = {
                color: 0x0099ff,
                title: 'Beep Boop...',
                description: user.displayName + ' is not listening to spotify!',
                thumbnail:{
                    url:'https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif',
                },
                timestamp: new Date(),
                footer: {
                    text: config.BOT_NAME +': ' + config.BOT_VERSION ,
                },
            };
            console.log(`Chiyoko Haruka>> Spotify Command Triggered: Status detection failed. User might not be listening to spotify? `)
            message.channel.send({ embed: spotifyerr });
        }
        else if (status !== null && status.type === "LISTENING" && status.name === "Spotify" && status.assets !== null) {
            let image = `https://i.scdn.co/image/${status.assets.largeImage.slice(8)}`,
                url = `https:/open.spotify.com/track/${status.syncID}`,
                name = status.details,
                artist = status.state,
                album = status.assets.largeText,
                timeStart = status.timestamps.start,
                timeEnd = status.timestamps.end,
                timeConvert = convert(timeEnd - timeStart);

            let minutes = timeConvert.minutes < 10 ? `0${timeConvert.minutes}` : timeConvert.minutes;
            let seconds = timeConvert.seconds < 10 ? `0${timeConvert.seconds}` : timeConvert.seconds;
            let time = `${minutes}:${seconds}`;

            const spotifyplay = new Discord.MessageEmbed()
                .setAuthor(user.user.tag, user.user.displayAvatarURL({ dynamic: true }))
                .setTitle("Listening to Spotify")
                .setColor('0x0099ff')
                .setThumbnail(image)
                .setDescription(`\`\`\`Song: ${name} \nAlbum: ${album} \nArtist: ${artist} \nDuration: ${time}\`\`\``)
                .setFooter(config.BOT_NAME +': ' + config.BOT_VERSION)
                .setTimestamp()
                console.log(`Chiyoko Haruka>> Spotify Command Triggered: Status detection success.`)
            return message.channel.send(spotifyplay)
        }


    }
}