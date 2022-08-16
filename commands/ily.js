const Discord = require('discord.js');
const config = require('../handlers/config.json');

module.exports = {
    name: 'iloveyou',
    description: `when user ask if the bot loves him/her the bot responds with no and a gif`,
    example: `${config.PREFIX}iloveyou`,
    
    run: async (client, message, args) =>{
        const member =  message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
        const ily = {
            color: 0x0099ff,
            title: 'Confession Response (ily.js)',
            description: `**${member.displayName}** I don't Love you.`,
            image:{
                url: `https://c.tenor.com/HYvhvbB4QmYAAAAC/blegh-hahaha.gif`,
            },
            timestamp: new Date(),
            footer: {
                text: config.BOT_NAME +': ' + config.BOT_VERSION ,
            },
        }
        message.channel.send({embed: ily});
    }
} 