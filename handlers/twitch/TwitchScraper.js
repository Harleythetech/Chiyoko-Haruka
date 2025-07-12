const axios = require('axios');
const {SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Twitch GraphQL API constants
const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql';
const TWITCH_HEADERS = {
    'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
    'Content-Type': 'application/json'
};

class TwitchScraper {
    constructor() {
        this.checkInterval = 10000; // 10 seconds
        this.intervalId = null;
        this.dataFile = path.join(__dirname, 'twitchData.json');
        this.data = { guilds: {} };
        this.lastDataReload = 0; // Track when we last reloaded data
        
        // Initialize caches (will be created lazily)
        this.statusCache = null;
        this.apiCache = null;
        
        this.loadData();
    }
    
    /**
     * Lazy initialization of caches
     */
    initializeCaches() {
        if (this.statusCache && this.apiCache) {
            return; // Already initialized
        }
        
        try {
            // Try to get memory manager - it might not be available during early startup
            const memoryManager = require('../memoryManager');
            
            // Cache for streamer status (2 minutes TTL, max 1000 entries)
            this.statusCache = memoryManager.createLRUCache('twitch-status', {
                max: 1000,
                ttl: 2 * 60 * 1000, // 2 minutes
                allowStale: true
            });
            
            // Cache for API responses (5 minutes TTL, max 500 entries)
            this.apiCache = memoryManager.createLRUCache('twitch-api', {
                max: 500,
                ttl: 5 * 60 * 1000, // 5 minutes
                allowStale: false
            });
            
        } catch (error) {
            // Fallback to Map-based caches if memory manager is not available
            console.warn('[TWITCH SCRAPER] Memory manager not available, using fallback caches');
            this.statusCache = new Map();
            this.apiCache = new Map();
        }
    }

    // Load data from JSON file
    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const rawData = fs.readFileSync(this.dataFile, 'utf8');
                this.data = JSON.parse(rawData);
            } else {
                console.warn('[TWITCH SCRAPER] No existing data file found, creating new one');
                this.data = { guilds: {} };
                this.saveData();
            }
        } catch (error) {
            console.error('[TWITCH SCRAPER] Error loading data:', error);
            this.data = { guilds: {} };
        }
    }

    // Save data to JSON file with atomic write operation
    saveData() {
        try {
            const tempFile = this.dataFile + '.tmp';
            const dataString = JSON.stringify(this.data, null, 2);
            
            // Write to temporary file first
            fs.writeFileSync(tempFile, dataString);
            
            // Atomic rename to actual file (this prevents corruption)
            fs.renameSync(tempFile, this.dataFile);
            
        } catch (error) {
            console.error('[TWITCH SCRAPER] Error saving data:', error);
            
            // Clean up temp file if it exists
            try {
                const tempFile = this.dataFile + '.tmp';
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
        }
    }

    // Start monitoring (Discord bot integration)
    startMonitoring(client) {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }


        
        this.intervalId = setInterval(async () => {
            await this.checkAllStreamers(client);
        }, this.checkInterval);

        // Do an initial check after 5 seconds
        setTimeout(() => this.checkAllStreamers(client), 5000);
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // Check all configured streamers
    async checkAllStreamers(client) {
        try {
            // Reload data every 5 minutes to pick up changes from other sources
            const now = Date.now();
            if (!this.lastDataReload || (now - this.lastDataReload) > 300000) { // 5 minutes
                this.loadData();
                this.lastDataReload = now;
            }

            for (const guildId in this.data.guilds) {
                const guildData = this.data.guilds[guildId];
                const guild = client.guilds.cache.get(guildId);
                
                if (!guild) continue;

                const notificationChannel = guild.channels.cache.get(guildData.notificationChannelId);
                if (!notificationChannel) continue;

                for (const streamer of guildData.streamers) {
                    await this.checkStreamer(streamer, notificationChannel, guildId);
                    
                    // Add delay between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        } catch (error) {
            console.error('[TWITCH SCRAPER] Error in checkAllStreamers:', error);
        }
    }

    // Check individual streamer
    async checkStreamer(streamer, notificationChannel, guildId) {
        try {
            const streamData = await this.checkIfLive(streamer.username);
            const wasLive = streamer.isLive;
            const isNowLive = streamData.isLive;

            // Update streamer status
            streamer.isLive = isNowLive;
            streamer.lastChecked = new Date().toISOString();

            if (streamData.title) streamer.lastStreamTitle = streamData.title;
            if (streamData.game) streamer.lastGameName = streamData.game;

            // Only notify on status change from offline to live
            // This ensures we only send one notification per live session
            if (!wasLive && isNowLive) {
                // Going live (was offline, now live)
                await this.sendLiveNotification(notificationChannel, streamer, streamData);
            }

            // Save data after all updates
            this.saveData();
        } catch (error) {
            console.error('[TWITCH SCRAPER] Error checking streamer:', { username: streamer.username, error: error.message });
        }
    }

    // Check if streamer is live using Twitch GraphQL API
    async checkIfLive(username) {
        // Ensure caches are initialized
        this.initializeCaches();
        
        // Check cache first
        const cacheKey = username.toLowerCase();
        const cached = this.apiCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            const payload = [{
                operationName: "StreamMetadata",
                variables: { channelLogin: username.toLowerCase() },
                query: `
                    query StreamMetadata($channelLogin: String!) {
                        user(login: $channelLogin) {
                            id
                            login
                            displayName
                            description
                            profileImageURL(width: 300)
                            bannerImageURL
                            roles {
                                isPartner
                                isAffiliate
                                isStaff
                            }
                            stream {
                                id
                                title
                                type
                                createdAt
                                viewersCount
                                game {
                                    id
                                    name
                                    displayName
                                    boxArtURL(width: 285, height: 380)
                                }
                                tags {
                                    id
                                    localizedName
                                }
                            }
                        }
                    }
                `
            }];

            const response = await axios.post(TWITCH_GQL_URL, payload, { 
                headers: TWITCH_HEADERS,
                timeout: 10000
            });

            const result = response.data[0];

            if (result.errors) {
                console.error('[TWITCH SCRAPER] GraphQL errors for user:', { username: username, errors: result.errors });
                const errorResult = { isLive: false, error: 'GraphQL API error' };
                this.apiCache.set(cacheKey, errorResult);
                return errorResult;
            }

            const user = result.data.user;
            
            if (!user) {
                console.log('[TWITCH SCRAPER] User not found:', { username: username });
                const notFoundResult = { isLive: false, error: 'User not found' };
                this.apiCache.set(cacheKey, notFoundResult);
                return notFoundResult;
            }

            const stream = user.stream;
            const isLive = !!stream;

            // Calculate uptime if live
            let uptime = null;
            if (stream) {
                const start = new Date(stream.createdAt);
                const now = new Date();
                uptime = Math.floor((now - start) / 60000); // uptime in minutes
            }

            const streamData = {
                isLive: isLive,
                title: stream?.title || user.displayName,
                game: stream?.game?.displayName || stream?.game?.name || null,
                viewers: stream?.viewersCount || null,
                thumbnail: stream?.game?.boxArtURL || null,
                profileImage: user.profileImageURL || null,
                uptime: uptime,
                tags: stream?.tags?.map(tag => tag.localizedName) || [],
                isPartner: user.roles?.isPartner || false,
                isAffiliate: user.roles?.isAffiliate || false,
                streamId: stream?.id || null,
                error: null
            };

            // Cache the result
            this.apiCache.set(cacheKey, streamData);
            return streamData;

        } catch (error) {
            console.error('[TWITCH SCRAPER] Error checking user via GraphQL:', { username: username, error: error.message });
            const errorResult = { isLive: false, error: error.message };
            
            // Cache error for shorter time to allow faster retry
            if (typeof this.apiCache.set === 'function') {
                // LRU cache supports TTL
                this.apiCache.set(cacheKey, errorResult, { ttl: 30000 }); // 30 seconds
            } else {
                // Fallback Map cache - just set normally
                this.apiCache.set(cacheKey, errorResult);
            }
            return errorResult;
        }
    }

    // Send live notification
    async sendLiveNotification(channel, streamer, streamData) {
        try {
            const embed = new EmbedBuilder()
                .setColor(0x9146FF)
                .setAuthor({
                    name: `${streamer.username} is now live!`, 
                    iconURL: 'https://github.com/Harleythetech/Chiyoko-Haruka/blob/main/handlers/img/glitch_flat_purple.png?raw=true'
                })
                .setTitle(streamData.title || 'No title available')
                .setURL(`https://www.twitch.tv/${streamer.username}`)
                .setThumbnail(streamData.profileImage)
                .setImage(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamer.username}-1280x720.jpg`)
                .setTimestamp()
                .setFooter({
                    text: 'Chiyoko Haruka • Twitch Notifications',
                    iconURL: 'https://i.imgur.com/mwOFCBO.png'
                });

            // Add game field if available
            if (streamData.game) {
                embed.addFields({
                    name: '🎮 Playing',
                    value: streamData.game,
                    inline: true
                });
            }

            // Add viewer count if available
            if (streamData.viewers) {
                embed.addFields({
                    name: '👥 Viewers',
                    value: streamData.viewers.toLocaleString(),
                    inline: true
                });
            }

            // Add uptime if available
            if (streamData.uptime) {
                const hours = Math.floor(streamData.uptime / 60);
                const minutes = streamData.uptime % 60;
                const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                embed.addFields({
                    name: '⏱️ Uptime',
                    value: uptimeStr,
                    inline: true
                });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Watch Stream')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.twitch.tv/${streamer.username}`)
            );

            await channel.send({ content: '@everyone', embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[TWITCH SCRAPER] Error sending notification for streamer:', { username: streamer.username, error: error.message });
        }
    }

    // Add streamer to monitoring
    addStreamer(guildId, channelId, username) {
        // Validate guildId to prevent prototype pollution
        if (!guildId || typeof guildId !== 'string' || guildId.includes('__proto__') || guildId.includes('constructor') || guildId.includes('prototype')) {
            return { success: false, message: 'Invalid guild ID' };
        }

        if (!this.data.guilds[guildId]) {
            this.data.guilds[guildId] = {
                streamers: [],
                notificationChannelId: channelId
            };
        }

        // Update notification channel
        this.data.guilds[guildId].notificationChannelId = channelId;

        // Check if streamer already exists
        const existing = this.data.guilds[guildId].streamers.find(s => s.username.toLowerCase() === username.toLowerCase());
        if (existing) {
            return { success: false, message: 'Streamer already being monitored' };
        }

        // Add new streamer
        const streamer = {
            id: Date.now().toString(),
            username: username.toLowerCase(),
            addedBy: 'Command',
            addedAt: new Date().toISOString(),
            isLive: false,
            lastChecked: null,
            lastStreamTitle: null,
            lastGameName: null
        };

        this.data.guilds[guildId].streamers.push(streamer);
        this.saveData();

        return { success: true, streamer };
    }

    // Remove streamer from monitoring
    removeStreamer(guildId, username) {
        // Validate guildId to prevent prototype pollution
        if (!guildId || typeof guildId !== 'string' || guildId.includes('__proto__') || guildId.includes('constructor') || guildId.includes('prototype')) {
            return { success: false, message: 'Invalid guild ID' };
        }

        if (!this.data.guilds[guildId]) {
            return { success: false, message: 'No streamers configured for this server' };
        }

        const index = this.data.guilds[guildId].streamers.findIndex(s => s.username.toLowerCase() === username.toLowerCase());
        if (index === -1) {
            return { success: false, message: 'Streamer not found' };
        }

        const removed = this.data.guilds[guildId].streamers.splice(index, 1)[0];
        this.saveData();

        return { success: true, streamer: removed };
    }

    // Get all streamers for a guild
    getStreamers(guildId) {
        // Validate guildId to prevent prototype pollution
        if (!guildId || typeof guildId !== 'string' || guildId.includes('__proto__') || guildId.includes('constructor') || guildId.includes('prototype')) {
            return [];
        }
        return this.data.guilds[guildId]?.streamers || [];
    }

    // Set notification channel for a guild
    setNotificationChannel(guildId, channelId) {
        // Validate guildId to prevent prototype pollution
        if (!guildId || typeof guildId !== 'string' || guildId.includes('__proto__') || guildId.includes('constructor') || guildId.includes('prototype')) {
            return { success: false, message: 'Invalid guild ID' };
        }

        if (!this.data.guilds[guildId]) {
            this.data.guilds[guildId] = {
                streamers: [],
                notificationChannelId: channelId
            };
        } else {
            this.data.guilds[guildId].notificationChannelId = channelId;
        }
        
        this.saveData();
        return { success: true, channelId };
    }

    // Get monitoring stats
    getStats() {
        let totalStreamers = 0;
        let totalGuilds = Object.keys(this.data.guilds).length;
        let liveStreamers = 0;
        let allStreamers = [];

        for (const guildId in this.data.guilds) {
            const streamers = this.data.guilds[guildId].streamers;
            totalStreamers += streamers.length;
            liveStreamers += streamers.filter(s => s.isLive).length;
            allStreamers = allStreamers.concat(streamers);
        }

        return {
            totalGuilds,
            totalStreamers,
            liveStreamers,
            isMonitoring: this.intervalId !== null && totalStreamers > 0,
            streamers: allStreamers,
            lastUpdate: new Date().toISOString()
        };
    }
}

module.exports = TwitchScraper;
