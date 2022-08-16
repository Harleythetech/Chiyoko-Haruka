const Discord = require('discord.js');
const config = require('../handlers/config.json');

module.exports = {
    name:"serverinfo",
    description: "Gets the info of the server where you initiated the command.",

    run:  async (client, message, args) =>{
        const serverico = {
            title:`${message.guild.name}'s info`,
            color: 0x009ff,
            description: `**Server Creation Date:** ${message.guild.createdAt.toDateString()} \n**Owner: ** ${message.guild.owner.user.tag} \n**Icon:**`,
            image:{
                 url: message.guild.iconURL({dynamic: true, size: 1024}),
            },
            footer:{
                text: `${config.BOT_NAME} : ${config.BOT_VERSION}`,
                timestamp: new Date(),
            },
        }
        //send
        console.log(`Chikyoko Haruka>> Server Info initiated.`)
        message.channel.send({embed: serverico})
    }
}

