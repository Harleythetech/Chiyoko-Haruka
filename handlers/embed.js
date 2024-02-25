const {Client,GatewayIntentBits, EmbedBuilder} = require('discord.js');
const client = new Client ({intents:[GatewayIntentBits.Guilds],  disableMentions: "all" });
const interaction = require('discord.js');
const {BOT_VERSION} = require('./config.json');
//Bot Up
const active = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Chiyoko Haruka is now active!`)
.setImage('https://64.media.tumblr.com/02dabf2a7299753f442feee1512e326c/tumblr_o2qhk8IoJs1tydz8to1_500.gif')
.setTimestamp()
.setFooter({text: BOT_VERSION});
//Error
const bug = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Error! Failed to execute command (╯°□°）╯︵ ┻━┻ `)
.setImage('https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif')
.setTimestamp()
.setFooter({text: BOT_VERSION});

const toomuch = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Two or more services detected, Bot Can only handle one at a time. `)
.setImage('https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif')
.setTimestamp()
.setFooter({text: BOT_VERSION});

const maintenance = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Uh oh.. This command is under Maintenance.`)
.setDescription(`My Creator is currently trying to resolve this issue, please try it some time again.`)
.setImage('https://media.tenor.com/BfK6Y-NtcJgAAAAC/kawaii.gif')
.setTimestamp()
.setFooter({text: BOT_VERSION});

// Not Listening
const notlistening = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`User is not Listening to music, please play a track first.`)
.setImage('https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif')
.setTimestamp()
.setFooter({text: BOT_VERSION});

const failedtoplay = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`Failed to play the track, please try again.`)
.setImage('https://y.yarn.co/1a53594b-f992-4a06-abf1-7ecf744d72ee_text.gif')
.setTimestamp()
.setFooter({text: BOT_VERSION});

const notoncall = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`Beep Boop...`)
.setDescription(`You must be in a voice channel to use this command.`)
.setImage('https://media1.tenor.com/m/alhd2-CQGpAAAAAC/animephone-animecute.gif')
.setTimestamp()
.setFooter({text: BOT_VERSION});

const left = new EmbedBuilder()
.setColor(0x0099ff)
.setTitle(`I got kicked out of the  voice channel.`)
.setDescription(`Why must you do this to me?`)
.setImage('https://gifdb.com/images/high/asteroid-in-love-anime-mai-crying-9e0su1232jzo9y01.gif')
.setTimestamp()
.setFooter({text: BOT_VERSION});
module.exports = {active, bug , toomuch, maintenance, notlistening, failedtoplay,notoncall, left};