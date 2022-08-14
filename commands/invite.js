const Discord = require('discord.js');
const config = require('../handlers/config.json');
module.exports = {
    name: 'invite',
    description: 'invites',
    run: async function (client, message, args){
        const invite = new Discord.MessageEmbed()
        .setTitle('Invite me to your server!')
        .setAuthor(config.BOT_NAME)
        .setDescription(`Add me to your server by [clicking here](${process.env.INVLINK})`)
        .setTimestamp()
        .setColor(0x0099ff)
        .setFooter(config.BOT_NAME +': ' + config.BOT_VERSION)

        message.channel.send(invite)
    }
}