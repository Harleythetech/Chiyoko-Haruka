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
const config = require('./handlers/config.json');

// Import link scanner
const linkScanner = require('./handlers/linkScanner');

// Import Twitch scraper
const TwitchScraper = require('./handlers/twitch/TwitchScraper');
let twitchScraper = null;

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
app.use(express.json()); // Parse JSON requests

// Serve Bootstrap and Bootstrap Icons locally for better performance
app.use('/bootstrap.min.css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css/bootstrap.min.css')));
app.use('/bootstrap.bundle.min.js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js')));
app.use('/bootstrap-icons.css', express.static(path.join(__dirname, 'node_modules/bootstrap-icons/font/bootstrap-icons.min.css')));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/bootstrap-icons/font/fonts')));

// Serve Dashboard
app.get('/', (req, res) => {
    res.render('index');
});

// Twitch API endpoints
app.get('/api/twitch/guilds', (req, res) => {
    if (!twitchScraper) {
        return res.json({ error: 'Twitch scraper not initialized' });
    }
    
    const guilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
        hasConfig: !!twitchScraper.data.guilds[guild.id]
    }));
    
    res.json({ guilds });
});

app.get('/api/twitch/guild/:guildId', (req, res) => {
    if (!twitchScraper) {
        return res.json({ error: 'Twitch scraper not initialized' });
    }
    
    // Reload data to ensure we have the latest information
    twitchScraper.loadData();
    
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    
    if (!guild) {
        return res.json({ error: 'Guild not found' });
    }
    
    const streamers = twitchScraper.getStreamers(guildId);
    const guildData = twitchScraper.data.guilds[guildId];
    
    const channels = guild.channels.cache
        .filter(channel => channel.type === 0) // Text channels only
        .map(channel => ({
            id: channel.id,
            name: channel.name
        }));
    
    res.json({
        guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL()
        },
        streamers,
        notificationChannelId: guildData?.notificationChannelId,
        channels
    });
});

app.post('/api/twitch/guild/:guildId/add', async (req, res) => {
    if (!twitchScraper) {
        return res.json({ error: 'Twitch scraper not initialized' });
    }
    
    const { guildId } = req.params;
    const { username, channelId } = req.body;
    
    if (!username || !channelId) {
        return res.json({ error: 'Username and channel ID are required' });
    }

    try {
        // Test if the Twitch user exists and get their actual display name
        const testResult = await twitchScraper.checkIfLive(username);
        if (testResult.error === 'User not found') {
            return res.json({ 
                success: false, 
                message: `Twitch user '${username}' not found. Please check the username and try again.`
            });
        }

        const result = twitchScraper.addStreamer(guildId, channelId, username);
        res.json(result);
    } catch (error) {
        console.error('[WEBGUI API] Error adding streamer:', error);
        res.json({ 
            success: false, 
            message: 'An error occurred while adding the streamer. Please try again later.' 
        });
    }
});

app.post('/api/twitch/guild/:guildId/remove', (req, res) => {
    if (!twitchScraper) {
        return res.json({ error: 'Twitch scraper not initialized' });
    }
    
    const { guildId } = req.params;
    const { username } = req.body;
    
    if (!username) {
        return res.json({ error: 'Username is required' });
    }
    
    const result = twitchScraper.removeStreamer(guildId, username);
    res.json(result);
});

app.post('/api/twitch/guild/:guildId/channel', (req, res) => {
    if (!twitchScraper) {
        return res.json({ error: 'Twitch scraper not initialized' });
    }
    
    const { guildId } = req.params;
    const { channelId } = req.body;
    
    if (!channelId) {
        return res.json({ error: 'Channel ID is required' });
    }
    
    const result = twitchScraper.setNotificationChannel(guildId, channelId);
    res.json(result);
});

app.get('/api/twitch/stats', (req, res) => {
    if (!twitchScraper) {
        return res.json({ error: 'Twitch scraper not initialized' });
    }
    
    // Reload data to ensure we have the latest information
    twitchScraper.loadData();
    
    const stats = twitchScraper.getStats();
    res.json(stats);
});

// ========================================
// Link Scanner API Routes
// ========================================

app.use(express.json()); // Add JSON parsing middleware

// Get all link scanner sources
app.get('/api/linkscanner/sources', (req, res) => {
    try {
        const sources = linkScanner.getSources();
        const status = linkScanner.getStatus();
        res.json({
            success: true,
            sources: sources,
            status: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Add a new source
app.post('/api/linkscanner/sources', (req, res) => {
    try {
        const sourceData = req.body;
        
        // Validate required fields
        if (!sourceData.url || !sourceData.name) {
            return res.status(400).json({
                success: false,
                error: 'URL and name are required'
            });
        }
        
        const newSource = linkScanner.addSource(sourceData);
        res.json({
            success: true,
            source: newSource,
            message: 'Source added successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Update an existing source
app.put('/api/linkscanner/sources/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updatedSource = linkScanner.updateSource(id, updateData);
        res.json({
            success: true,
            source: updatedSource,
            message: 'Source updated successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Delete a source
app.delete('/api/linkscanner/sources/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedSource = linkScanner.deleteSource(id);
        res.json({
            success: true,
            source: deletedSource,
            message: 'Source deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get link scanner status and statistics
app.get('/api/linkscanner/status', (req, res) => {
    try {
        const status = linkScanner.getStatus();
        res.json({
            success: true,
            status: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Force refresh blocklists
app.post('/api/linkscanner/refresh', (req, res) => {
    try {
        // Reset cache to force refresh
        linkScanner.blocklistLastUpdate = 0;
        linkScanner.updateBlocklists().then(() => {
            res.json({
                success: true,
                message: 'Blocklists refresh initiated'
            });
        }).catch(error => {
            res.status(500).json({
                success: false,
                error: error.message
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================

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

    // Send initial Twitch data
    if (twitchScraper) {
        const twitchStats = twitchScraper.getStats();
        socket.emit('twitchStats', twitchStats);
    }

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
        
        // Emit Twitch stats
        if (twitchScraper) {
            const twitchStats = twitchScraper.getStats();
            io.emit('twitchStats', twitchStats);
        }
        
        // Emit Link Scanner stats
        if (linkScanner) {
            try {
                const linkScannerStats = {
                    status: linkScanner.getStatus(),
                    sources: linkScanner.getSources()
                };
                io.emit('linkScannerStats', linkScannerStats);
            } catch (error) {
                console.error('Error getting Link Scanner stats:', error);
            }
        }
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
    
    // Initialize Twitch monitoring
    try {
        twitchScraper = new TwitchScraper();
        twitchScraper.startMonitoring(client);
    } catch (error) {
        console.error('[TWITCH] Error initializing Twitch monitoring:', error);
    }
    
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

// Link Scanner - Message Handler
client.on(Events.MessageCreate, async message => {
    // Skip bot messages and messages without content
    if (message.author.bot || !message.content) return;
    
    try {
        // Scan the message for scam links
        const scanResult = await linkScanner.scanMessage(message);
        
        if (scanResult.isScam) {
            // Log the detection with source information
            const detectionInfo = scanResult.detections.map(d => `${d.domain} (${d.source})`).join(', ');
            customLogger.warn(`[LINK SCANNER] Scam link detected in ${message.guild.name} from ${message.author.username}: ${detectionInfo}`);
            
            // Delete the message (if bot has permissions)
            try {
                await message.delete();
                customLogger.log(`[LINK SCANNER] Deleted message containing scam links from ${message.author.username}`);
            } catch (deleteError) {
                customLogger.error(`[LINK SCANNER] Failed to delete scam message: ${deleteError.message}`);
            }
            
            // Send warning in the channel
            const warningEmbed = linkScanner.createScamWarningEmbed(scanResult.detections, message.author);
            
            try {
                const warningMessage = await message.channel.send({ 
                    embeds: [warningEmbed],
                    content: `⚠️ <@${message.author.id}> **Message deleted for containing scam links!**`
                });
                
                // Auto-delete warning after 30 seconds to reduce spam
                setTimeout(async () => {
                    try {
                        await warningMessage.delete();
                    } catch (error) {
                        // Ignore errors if message is already deleted
                    }
                }, 30000);
                
            } catch (embedError) {
                customLogger.error(`[LINK SCANNER] Failed to send warning embed: ${embedError.message}`);
            }
            
            // Try to DM the user with more information
            try {
                const dmDetectionList = scanResult.detections.map(d => `• \`${d.domain}\` - *Detected by ${d.source}*`).join('\n');
                const dmEmbed = linkScanner.createScamWarningEmbed(scanResult.detections, message.author)
                    .setTitle('🚨 Your message was flagged for scam content')
                    .setDescription(
                        `Your message in **${message.guild.name}** was automatically deleted because it contained known scam/phishing links.\n\n` +
                        `**Detected domains:**\n${dmDetectionList}\n\n` +
                        `If you believe this was a mistake, please contact the server moderators.`
                    );
                
                await message.author.send({ embeds: [dmEmbed] });
                customLogger.log(`[LINK SCANNER] Sent DM warning to ${message.author.username}`);
                
            } catch (dmError) {
                // User might have DMs disabled - this is fine
                customLogger.log(`[LINK SCANNER] Could not DM ${message.author.username} (DMs likely disabled)`);
            }
        }
        
    } catch (error) {
        customLogger.error(`[LINK SCANNER] Error scanning message: ${error.message}`);
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