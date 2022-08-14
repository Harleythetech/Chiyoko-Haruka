const config = require('../handlers/config.json');
module.exports = {
    name: 'info',
    description: 'Makes Bot introduce it self',
    run(client, message, args){
        const user = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
        const botinf = {
            color: 0x0099ff,
            title: config.BOT_NAME,
            author: {
                name: 'Introduction',
            },
            description: 'Hello there ' + user.displayName + ' Im ' + config.BOT_NAME +  ', My Prefix is ' + `\`${config.PREFIX}\`` +
            ' and currently im under development so please have pateince in me and my developer as he is learning JS' + 
            ', Thank you for testing me out! ',
            thumbnail: {
                url: 'https://i.imgur.com/mwOFCBO.png',
            },
            timestamp: new Date(),
            footer: {
                text: config.BOT_NAME +': ' + config.BOT_VERSION ,
            },
        };
        message.channel.send({ embed: botinf });
    },
};