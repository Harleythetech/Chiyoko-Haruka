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
.setFooter({text: 'Chiyoko Haruka: V0.3.r003s'});
//Error
const bug = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Error! Failed to execute command (╯°□°）╯︵ ┻━┻ `)
.setImage('https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif')
.setTimestamp()
.setFooter({text: 'Chiyoko Haruka: V0.3.r003s'});

const toomuch = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Two or more services detected, Bot Can only handle one at a time. `)
.setImage('https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif')
.setTimestamp()
.setFooter({text: 'Chiyoko Haruka: V0.3.r003s'});

const maintenance = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Uh oh.. This command is under Maintenance.`)
.setDescription(`My Creator is currently trying to resolve this issue, please try it some time again.`)
.setImage('https://media.tenor.com/BfK6Y-NtcJgAAAAC/kawaii.gif')
.setTimestamp()
.setFooter({text: 'Chiyoko Haruka: V0.3.r003s'});

// Not Listening
const notlistening = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`User is not Listening to music, please play a track first.`)
.setImage('https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif')
.setTimestamp()
.setFooter({text: 'Chiyoko Haruka: V0.3.r003s'});
module.exports = {active, bug , toomuch, maintenance, notlistening};