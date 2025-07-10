const fs = require('fs'); // File System Module
const os = require('os'); // Operating System Module for hostname detection
const {Client, Events, GatewayIntentBits, Collection, ActivityType, EmbedBuilder, MessageFlags} = require('discord.js');
const {getVoiceConnection} = require('@discordjs/voice');
const client = new Client ({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], disableMentions: "all"});
const path = require('path');
const folderPath = path.join(__dirname, 'Commands');
const commandFolders = fs.readdirSync(folderPath);
const {active, bug} = require('./handlers/embed.js');
require('dotenv').config();
const config = require('./handlers/config.json')

// New dependencies for monitoring
const pidusage = require('pidusage');
const express = require('express');
const http = require('http');
const {Server} = require('socket.io');

// Import music manager
let musicManager = null;

// Function to get music manager instance
function getMusicManager() {
    if (!musicManager) {
        try {
            const musicPlayerModule = require('./Commands/media/MusicPlayer.js');
            // Access the singleton instance from the module
            musicManager = require('./Commands/media/MusicPlayer.js');
        } catch (error) {
            customLogger.Error('[WEBGUI] Music manager not available');
        }
    }
    return musicManager;
}

// Initiate WEBGUI
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Setup EJS Render
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'WEBGUI/views'));
app.use(express.static(path.join(__dirname, 'WEBGUI/public')));

// Serve Bootstrap and Bootstrap Icons locally for better performance
app.use('/bootstrap.min.css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css/bootstrap.min.css')));
app.use('/bootstrap.bundle.min.js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js')));
app.use('/bootstrap-icons.css', express.static(path.join(__dirname, 'node_modules/bootstrap-icons/font/bootstrap-icons.min.css')));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/bootstrap-icons/font/fonts')));

// Serve Dashboard
app.get('/', (req, res) => {
    res.render('index');
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WEBGUI - SERVER] Server is running on 0.0.0.0:${PORT}`);
});

// Websocket Connection
io.on('connection', (socket) => {
    
    io.emit('version', config.BOT_VERSION);
    io.emit('clientid', socket.id);
    
    // Send system hostname to dashboard
    const systemHostname = os.hostname();
    const networkInterfaces = os.networkInterfaces();
    
    
    // Get the primary IP address (prefer non-loopback IPv4)
    let primaryIP = '127.0.0.1';
    for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];
        for (const addr of addresses) {
            if (addr.family === 'IPv4' && !addr.internal) {
                primaryIP = addr.address;
                break;
            }
        }
        if (primaryIP !== '127.0.0.1') break;
    }
    
    
    // Send host information to the connected client
    const hostInfo = {
        hostname: systemHostname,
        ip: primaryIP,
        platform: os.platform(),
        arch: os.arch()
    };
    
    socket.emit('hostInfo', hostInfo);

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

            // Enhanced system information
            const cpuPercent = stats.cpu.toFixed(1);
            const memoryBytes = stats.memory;
            const memoryMB = (memoryBytes / (1024 * 1024)).toFixed(1);
            const memoryPercent = Math.min((memoryBytes / (1 * 1024 * 1024 * 1024)) * 100, 100).toFixed(1);
            
            const systemInfo = {
                cpu: cpuPercent,
                memory: {
                    percent: memoryPercent,
                    used: memoryMB,
                    bytes: memoryBytes
                },
                uptime: formatRuntime(stats.elapsed),
                process: {
                    pid: process.pid,
                    version: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    startTime: new Date(Date.now() - stats.elapsed).toLocaleString()
                }
            };
            
            io.emit('ResourceUsage', systemInfo);
            
            // Also emit the legacy format for backward compatibility
            const ProcD = [cpuPercent, memoryPercent, formatRuntime(stats.elapsed)];
            io.emit('ResourceUsageLegacy', ProcD);
        });
    }, 2000); // Reduced frequency for better performance
}

// Music Monitoring
function monitorMusic() {
    setInterval(() => {
        try {
            // Access music manager from the loaded command
            const musicCommand = client.commands.get('play-music');
            if (musicCommand && musicCommand.musicManager) {
                const musicData = musicCommand.musicManager.getWebDashboardData();
                
                // Enhance the data with Discord server information
                if (musicData.currentSongs.length > 0) {
                    musicData.currentSongs = musicData.currentSongs.map(song => {
                        const guild = client.guilds.cache.get(song.guildId);
                        return {
                            ...song,
                            serverName: guild?.name || 'Unknown Server',
                            serverIcon: guild?.iconURL() || null
                        };
                    });
                }
                
                io.emit('musicUpdate', musicData);
            } else {
                // Send empty music data if no music manager is available
                io.emit('musicUpdate', {
                    hasActiveMusic: false,
                    activePlayersCount: 0,
                    currentSongs: [],
                    totalServersWithPlayers: 0
                });
            }
        } catch (error) {
            // Send empty music data on error
            io.emit('musicUpdate', {
                hasActiveMusic: false,
                activePlayersCount: 0,
                currentSongs: [],
                totalServersWithPlayers: 0
            });
        }
    }, 2000);
}

// Get current music data from all servers (fallback method)
function getMusicData() {
    const musicData = {
        hasActiveMusic: false,
        activePlayersCount: 0,
        currentSong: null,
        servers: []
    };

    try {
        // Get all voice connections
        const { getVoiceConnections } = require('@discordjs/voice');
        const connections = getVoiceConnections();
        
        let activeCount = 0;
        let currentMusic = null;

        // Iterate through connections to find active music
        for (const [guildId, connection] of connections) {
            const guild = client.guilds.cache.get(guildId);
            if (guild && connection) {
                activeCount++;
                
                // Try to get current music info - this would need to be exposed from MusicManager
                // For now, we'll create a mock structure that can be populated
                const mockCurrentSong = {
                    title: "Sample Song Title",
                    artist: "Sample Artist",
                    duration: "3:45",
                    thumbnail: "https://i3.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
                    url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
                    requestedBy: "SampleUser",
                    serverName: guild.name,
                    queueCount: 3,
                    voiceUsers: connection.joinConfig.channelId ? 
                        guild.channels.cache.get(connection.joinConfig.channelId)?.members.size || 0 : 0
                };
                
                if (!currentMusic) {
                    currentMusic = mockCurrentSong;
                }
                
                musicData.servers.push({
                    guildId: guildId,
                    serverName: guild.name,
                    hasMusic: true
                });
            }
        }

        musicData.activePlayersCount = activeCount;
        musicData.hasActiveMusic = activeCount > 0;
        musicData.currentSong = currentMusic;

    } catch (error) {
        // Handle errors silently
    }

    return musicData;
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
    monitorMusic();
});

// Interaction Handler
client.on(Events.InteractionCreate, async interaction => {
    // Handle button interactions
    if (interaction.isButton()) {
        // Check if it's any music-related button (download or media controls)
        if (interaction.customId.startsWith('download_song_') || interaction.customId.startsWith('music_')) {
            const musicCommand = client.commands.get('play-music');
            if (musicCommand && musicCommand.musicManager) {
                try {
                    await musicCommand.musicManager.handleButtonInteraction(interaction);
                } catch(error) {
                    customLogger.error(`[ERROR - BUTTON INTERACTION] ${error}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred while processing your request.',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
            }
        }
        return;
    }

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
    // Don't log aborted errors as they're normal for voice streams
    if (error.message && error.message.includes('aborted')) {
        customLogger.warn('[INFO] Stream operation aborted (normal for voice connections)');
    } else {
        customLogger.error(`[ERROR - UNHANDLED REJECTION] ${error}`);
    }
});

// Error on Uncaught Exception
process.on('uncaughtException', error => {
    // Don't crash on aborted errors
    if (error.message && error.message.includes('aborted')) {
        customLogger.warn('[INFO] Stream operation aborted (normal for voice connections)');
    } else {
        customLogger.error(`[ERROR - UNCAUGHT EXCEPTION] ${error}`);
        // Only exit on serious errors, not aborted streams
        process.exit(1);
    }
});

//Bot Login
client.login(process.env.TOKEN);

console.log('   _____ _     _             _           _    _                  _         \r\n  \/ ____| |   (_)           | |         | |  | |                | |        \r\n | |    | |__  _ _   _  ___ | | _____   | |__| | __ _ _ __ _   _| | ____ _ \r\n | |    | \'_ \\| | | | |\/ _ \\| |\/ \/ _ \\  |  __  |\/ _` | \'__| | | | |\/ \/ _` |\r\n | |____| | | | | |_| | (_) |   < (_) | | |  | | (_| | |  | |_| |   < (_| |\r\n  \\_____|_| |_|_|\\__, |\\___\/|_|\\_\\___\/  |_|  |_|\\__,_|_|   \\__,_|_|\\_\\__,_|\r\n                  __\/ |                                                    \r\n                 |___\/                                                     ');