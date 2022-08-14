const Discord = require('discord.js');
const config = require('../handlers/config.json');


module.exports = {
    name: "avatar",
    category: "Utility",
    description: "Gets the avatar of the mentioned user",

    run: async (client, message, args) => {
      const member =  message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
      const avatar = new Discord.MessageEmbed()
        .setColor(0x0099ff)
        .setTitle(`${member.displayName}'s Avatar`)
        .setAuthor(config.BOT_NAME)
        .setImage(member.user.displayAvatarURL({ dynamic: true, size:  1024 }))
        .setTimestamp(new Date())
        .setFooter(config.BOT_NAME +': ' + config.BOT_VERSION);
    message.channel.send({ embed: avatar });
  }
}