const {Client,GatewayIntentBits, EmbedBuilder} = require('discord.js');
const client = new Client ({intents:[GatewayIntentBits.Guilds],  disableMentions: "all" });
const interaction = require('discord.js');
//Bot Up
const active = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Chiyoko Haruka is now active!`)
.setImage('https://64.media.tumblr.com/02dabf2a7299753f442feee1512e326c/tumblr_o2qhk8IoJs1tydz8to1_500.gif')
.setTimestamp()
.setFooter({text: 'Chiyoko Haruka: V0.2.r002s'});
//Error
const bug = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Error! Failed to execute command (╯°□°）╯︵ ┻━┻ `)
.setImage('https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif')
.setTimestamp()
.setFooter({text: 'Chiyoko Haruka: V0.2.r002s'});

const toomuch = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Two or more services detected, Bot Can only handle one at a time. `)
.setImage('https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif')
.setTimestamp()
.setFooter({text: 'Chiyoko Haruka: V0.2.r002s'});
module.exports = {active, bug , toomuch};