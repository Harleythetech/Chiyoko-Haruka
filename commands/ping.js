const config = require('../handlers/config.json');
module.exports = {
    name: 'ping',
    description: 'Checks Ping',
    run(client, message, args){
        const pingbed = {
            color: 0x0099ff,
            title: '🏓Ping Pong',
            author: {
                name: config.BOT_NAME,
            },
            description: (`**Latency:** **\`${Date.now()-message.createdTimestamp}\`** ms\n**API Latency:** **\`${Math.round(client.ws.ping)}\`** ms`),
            thumbnail: {
                url: 'https://media2.giphy.com/media/ECwTCTrHPVqKI/giphy.gif?cid=ecf05e47pyut03gtv3uo3ok10nosqd106gdwct60ptftxw51&rid=giphy.gif&ct=g',
            },
            timestamp: new Date(),
            footer: {
                text: config.BOT_NAME +': ' + config.BOT_VERSION,
            },
        };
        message.channel.send({ embed: pingbed });
    },
};