const fs = require('fs'); // File System Module
const {Client, Events, GatewayIntentBits, Collection, ActivityType, EmbedBuilder} = require('discord.js');
const {getVoiceConnection} = require('@discordjs/voice');
const client = new Client ({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], disableMentions: "all"});
const path = require('path');
const folderPath = path.join(__dirname, 'Commands');
const commandFolders = fs.readdirSync(folderPath);
const {active, bug} = require('./handlers/embed.js');
require('dotenv').config();
const sdp = require("stop-discord-phishing");
const config = require('./handlers/config.json')

// New dependencies for monitoring
const pidusage = require('pidusage');
const express = require('express');
const http = require('http');
const {Server} = require('socket.io');

// Initiate WEBGUI
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Setup EJS Render
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'WEBGUI/views'));
app.use(express.static(path.join(__dirname, 'WEBGUI/public')));

// Serve Dashboard
app.get('/', (req, res) => {
    res.render('index');
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[WEBGUI - SERVER] Server is running on http://localhost:${PORT}`);
});

// Websocket Connection
io.on('connection', (socket) => {
    io.emit('version', config.BOT_VERSION);
    io.emit('clientid', socket.id);
})


// Custom logger to capture logs
const customLogger = {
    log: (message) => {
        io.emit('log', `[LOG] ${message}`);
    },
    warn: (message) => {
        io.emit('log', `[WARN] ${message}`);
    },
    error: (message) => {
        console.error((`[ERROR] ${message}`));
        io.emit('log', `[ERROR] ${message}`);
    }
};


// Convert ms to HH:MM:SS
function formatRuntime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format as HH:MM:SS
    return [hours, minutes, seconds]
        .map(unit => String(unit).padStart(2, '0')) // Ensure two-digit formatting
        .join(':');
}

// Heartbeat Function
function heartbeat(){
    setInterval(()=>{
        const ping = client.ws.ping;
        io.emit('status', client.ws.status);
        io.emit('guildsize', client.guilds.cache.size);
        io.emit('usercount', client.users.cache.size);
        io.emit('heartbeat', ping);
    }, 3000);
}

// Resource Monitoring
function monitorResources() {
    setInterval(() => {
        pidusage(process.pid, (err, stats) => {
            if (err) {
                return;
            }

            // Convert memory to percentage (assuming 16GB max RAM as example)
            const cpuPercent = stats.cpu.toFixed(1);
            const memoryPercent = Math.min((stats.memory / (1 * 1024 * 1024 * 1024)) * 100, 100).toFixed(1);
            const ProcD = [cpuPercent, memoryPercent, formatRuntime(stats.elapsed)];
            io.emit('ResourceUsage', ProcD);
        });
    }, 100);
}


// Bot Command Handler
client.commands = new Collection();

for (const folder of commandFolders){
    const cmdpath = path.join(folderPath, folder);
    const cmdfs = fs.readdirSync(cmdpath).filter(file => file.endsWith('.js'));

    for(const file of cmdfs){
        const fspath = path.join(cmdpath, file);
        const cmd = require(fspath);

        if ('data' in cmd && 'execute' in cmd){
            client.commands.set(cmd.data.name, cmd);
        }else{
            customLogger.warn(`[WARNING - COMMAND HANDLER] The command at ${fspath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Client Once Ready
client.on(Events.ClientReady, c => {
    console.log(`[READY - CLIENT] ${c.user.tag} is now online!`);
    client.user.setActivity(client.guilds.cache.size + ' Servers', {type: ActivityType.Listening}); //Sets the bot's activity to listening to the number of servers it is in
    // Sends ON Signal to Log Channel when the bot is ready
    const logch = client.channels.cache.get(process.env.CHANNEL_ID);
    logch.send({embeds: [active]});
    // Start monitoring
    heartbeat();
    monitorResources();
});

// Message With Link detection and Scam Detection powered by Stop Discord Phishing
client.on(Events.MessageCreate, async message => {
    const userlink = message.content;
    const urlRegex = /((https?:\/\/|ftp:\/\/|sftp:\/\/|file:\/\/|gopher:\/\/|telnet:\/\/|nntp:\/\/|imap:\/\/|wais:\/\/|mailto:|news:|rtsp:\/\/|svn:\/\/|git:\/\/|ssh:\/\/|rsync:\/\/|www\.)[\w\-]+(\.[\w\-]+)+[#?/\w\-=&.%]*)|[\w\-]+\.[a-zA-Z]{2,}(\/[#?/\w\-=&.%]*)?/gi;
    const urlraw = userlink.match(urlRegex);
    
    if (urlraw != null) {
        for (const url of urlraw) {
            // Normalize URL if it starts with www.
            const normalizedUrl = url.startsWith('www.') ? `https://${url}` : url;
            
            const data = await sdp.checkMessage(normalizedUrl, true);
            if (data == true) {
                const embed = new EmbedBuilder()
                    .setTitle('Danger: Scam Link Detected')
                    .setDescription(`Phishing Link detected, message automatically deleted for your safety.`)
                    .setColor(0xff0000)
                    .setImage('https://media.tenor.com/ayZKpLp26ZkAAAAd/this-is-dangerous.gif');
                
                await message.channel.send({ embeds: [embed] });
                await message.delete();
            }
        }
    }
});

// Interaction Handler
// Interaction Handler
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        // Log command usage
        customLogger.log(`[COMMAND - ${new Date().toLocaleString()}])} ${interaction.commandName} | Server: ${interaction.guild.name}`);
        
        await command.execute(interaction);
    } catch(error) {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({embeds: [bug]});
            customLogger.error(`[BUG - INTERACTION HANDLER] ${bug}`);
        } else {
            await interaction.followUp({embeds: [bug]});
            customLogger.error(`[ERROR - INTERACTION HANDLER] ${error}`);
        }
    }
});

// Voice State Update
client.on('voiceStateUpdate', (oldsState, newState) => {
    if (newState.member.user.bot && newState.channel === null && oldsState.channel){
        const connection = getVoiceConnection(oldsState.guild.id);

        if (connection){
            reset(); // if the bot has been disconnected for some time, reset on disconnection.
        }
    }
})

global.reportError = (error, context = 'General', module = 'Unknown') => {
    const ecode = `[${module.toUpperCase()}] [${new Date().toLocaleString()}] ${context.toUpperCase()} | ${error}`;
    customLogger.error(ecode);
};

global.reportLog = (log, context = 'General', module = 'Unknown') => {
    const lcode = `[${module.toUpperCase()} | ${new Date().toLocaleString()}] | ${context.toUpperCase()} | ${log}`;
    customLogger.log(lcode);
};

// Error on Unhandled Rejection
process.on('unhandledRejection', error => {
    customLogger.error(`[ERROR - UNHANDLED REJECTION] ${error}`);
});

// Error on Uncaught Exception
process.on('uncaughtException', error => {
    customLogger.error(`[ERROR - UNCAUGHT EXCEPTION] ${error}`);
});

//Bot Login
client.login(process.env.TOKEN);

console.log('   _____ _     _             _           _    _                  _         \r\n  \/ ____| |   (_)           | |         | |  | |                | |        \r\n | |    | |__  _ _   _  ___ | | _____   | |__| | __ _ _ __ _   _| | ____ _ \r\n | |    | \'_ \\| | | | |\/ _ \\| |\/ \/ _ \\  |  __  |\/ _` | \'__| | | | |\/ \/ _` |\r\n | |____| | | | | |_| | (_) |   < (_) | | |  | | (_| | |  | |_| |   < (_| |\r\n  \\_____|_| |_|_|\\__, |\\___\/|_|\\_\\___\/  |_|  |_|\\__,_|_|   \\__,_|_|\\_\\__,_|\r\n                  __\/ |                                                    \r\n                 |___\/                                                     ');