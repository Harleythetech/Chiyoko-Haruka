//required files
const fs = require('fs');
const Discord = require('discord.js');
const config = require('./handlers/config.json');
const client = new Discord.Client({ disableMentions: "all" });
client.commands = new Discord.Collection();
require('dotenv').config();

//Client Login
client.on("ready", ()=>{
    client.user.setActivity("JS: v.0.1.ch1r.canary", {type: "PLAYING"});
    console.log('Chikyoko Haruka>> System is now loaded and is ready to have fun!');
    const logch = client.channels.cache.get(process.env.chid);
	const online = {
		color: 0x0099ff,
		title: 'Beep Boop...',
		description: `Chiyoko Haruka is now active!`,
		thumbnail: {
			url: 'https://64.media.tumblr.com/02dabf2a7299753f442feee1512e326c/tumblr_o2qhk8IoJs1tydz8to1_500.gif',
		},
		timestamp: new Date(),
		footer: {
			text: config.BOT_NAME +': ' + config.BOT_VERSION ,
		},
	};
	logch.send({ embed: online });
});

//Client Start
client.login(process.env.TOKEN);

//command handler
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);	
	client.commands.set(command.name, command);
}

//Command Starter
client.on('message', message => {
	if (!message.content.startsWith(config.PREFIX) || message.author.bot) return;
	const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();
	if (!client.commands.has(command)) return;

	try {
		client.commands.get(command).run(client, message, args);
	} catch (error) {
		console.error(error);
		const err = {
            color: 0x0099ff,
            title: 'Beep Boop...',
            description: 'Error! Failed to execute command (╯°□°）╯︵ ┻━┻ ' + `${error}`,
			thumbnail:{
				url:'https://c.tenor.com/_3mSq0fET5oAAAAC/tenor.gif',
			},
            timestamp: new Date(),
            footer: {
                text: config.BOT_NAME +': ' + config.BOT_VERSION ,
            },
        };
        message.channel.send({ embed: err });
	}
});