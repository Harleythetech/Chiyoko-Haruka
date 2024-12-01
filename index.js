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

// New dependencies for monitoring
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const pidusage = require('pidusage');
const colors = require('ansi-colors');

// Create blessed screen
const screen = blessed.screen({
    smartCSR: true,
    title: 'Chiyoko Haruka Bot Monitor'
});

// Title Box
const titleBox = blessed.box({
    top: 1,
    left: 0,
    width: '100%',
    height: 3,
    content: 'Chiyoko Haruka V5.0 - Catalyst',
    align: 'center',
    valign: 'middle',
    style: {
        fg: 'white',
        bg: 'blue',
        bold: true
    }
});
screen.append(titleBox);

// Create layout
const grid = new contrib.grid({rows: 12, cols: 12, screen: screen, top: 3});

// Heartbeat Line Graph
const heartbeatGraph = grid.set(0, 0, 4, 6, contrib.line, {
    style: { 
        line: "yellow",
        text: "green",
        baseline: "black"
    },
    label: 'Heartbeat (ms)',
    maxY: 500,
    showLegend: true
});

// Resource Usage Box
const resourceBox = grid.set(0, 6, 4, 6, blessed.box, {
    label: 'Resource Usage',
    border: 'line',
    style: {
        fg: 'white'
    }
});

// Function to create progress bar
function createProgressBar(percent) {
    // Ensure percent is a number
    const numPercent = Number(percent);
    
    // Check if the conversion resulted in a valid number
    if (isNaN(numPercent)) {
        return 'Invalid Percentage | 0%';
    }
    
    // Clamp the percentage between 0 and 100
    const clampedPercent = Math.min(Math.max(numPercent, 0), 100);
    
    const barLength = 40;
    const filledLength = Math.round((clampedPercent / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    return `${filledBar}${emptyBar} | ${clampedPercent.toFixed(1)}%`;
}

// Logs Box
const logBox = grid.set(4, 0, 8, 12, blessed.log, {
    label: 'Logs',
    border: 'line',
    scrollable: true,
    alwaysScroll: true,
    scrollback: 100,
    style: {
        fg: 'white',
        border: {
            fg: '#f0f0f0'
        }
    }
});

// Heartbeat Tracking
const heartbeatData = {
    title: `Ping  `,
    x: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    y: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};

// Custom logger to capture logs
const customLogger = {
    log: (message) => {
        logBox.log(colors.green(`${message}`));
    },
    warn: (message) => {
        logBox.log(colors.yellow(`[WARN] ${message}`));
    },
    error: (message) => {
        logBox.log(colors.red(`[ERROR] ${message}`));
    }
};

// Heartbeat Function
function heartbeat(){
    setInterval(()=>{
        const ping = client.ws.ping;
        
        // Shift data points
        heartbeatData.y.shift();
        heartbeatData.y.push(ping);
        heartbeatData.title = `Ping ${ping}ms`;
        // Update graph
        heartbeatGraph.setData([heartbeatData]);
        screen.render();
    }, 3000);
}

// Resource Monitoring
function monitorResources() {
    setInterval(() => {
        pidusage(process.pid, (err, stats) => {
            if (err) {
                resourceBox.setContent('Failed to get resource usage');
                return;
            }

            // Convert memory to percentage (assuming 16GB max RAM as example)
            const cpuPercent = stats.cpu.toFixed(1);
            const memoryPercent = Math.min((stats.memory / (1 * 1024 * 1024 * 1024)) * 100, 100).toFixed(1);

            const content = [
                `CPU: ${createProgressBar(cpuPercent)}`,
                `RAM: ${createProgressBar(memoryPercent)}`,
                `PID: ${stats.pid}`,
                `Runtime: ${Math.floor(stats.elapsed / 1000)} seconds`
            ].join('\n');

            resourceBox.setContent(content);
            screen.render();
        });
    }, 100);
}

screen.render();

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
    customLogger.log(`[READY - CLIENT] ${c.user.tag} is now online!`);
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
        customLogger.log(`${colors.yellow(`[COMMAND - ${new Date().toLocaleString()}]`)} ${interaction.commandName} | Server: ${interaction.guild.name}`);
        
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

// Error on Unhandled Rejection
process.on('unhandledRejection', error => {
    customLogger.error(`[ERROR - UNHANDLED REJECTION] ${error}`);
});

// Error on Uncaught Exception
process.on('uncaughtException', error => {
    customLogger.error(`[ERROR - UNCAUGHT EXCEPTION] ${error}`);
});

//Bot Login
client.login(process.env.token);