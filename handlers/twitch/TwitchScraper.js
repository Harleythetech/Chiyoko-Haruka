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
        this.checkInterval = 5000; // 5 seconds for faster detection
        this.intervalId = null;
        this.dataFile = path.join(__dirname, 'twitchData.json');
        this.data = { guilds: {} };
        this.lastDataReload = 0; // Track when we last reloaded data
        
        // Disable caching for real-time detection
        this.statusCache = null;
        this.apiCache = null;
        
        this.loadData();
    }
    
    /**
     * Cache initialization disabled for real-time detection
     */
    initializeCaches() {
        // Caching disabled to ensure real-time stream status detection
        console.log('[TWITCH SCRAPER] Caching disabled for real-time detection');
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

        // Do an initial check after 2 seconds for faster startup
        setTimeout(() => this.checkAllStreamers(client), 2000);
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
                    
                    // Reduced delay for faster detection (balance between speed and rate limiting)
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second instead of 2
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
                // Wait a moment to ensure stream data is fully populated
                console.log(`[TWITCH SCRAPER] ${streamer.username} went live, waiting for complete data...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 3 seconds
                
                // Fetch fresh data again to ensure we have complete information
                const freshStreamData = await this.checkIfLive(streamer.username);
                
                // Validate that we have sufficient data before sending notification
                if (this.validateStreamData(freshStreamData, streamer.username)) {
                    await this.sendLiveNotification(notificationChannel, streamer, freshStreamData);
                } else {
                    console.log(`[TWITCH SCRAPER] Insufficient data for ${streamer.username}, skipping notification`);
                }
            }

            // Save data after all updates
            this.saveData();
        } catch (error) {
            console.error('[TWITCH SCRAPER] Error checking streamer:', { username: streamer.username, error: error.message });
        }
    }

    // Check if streamer is live using Twitch GraphQL API (No caching for real-time detection)
    async checkIfLive(username) {
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
                timeout: 8000 // Reduced timeout for faster detection
            });

            const result = response.data[0];

            if (result.errors) {
                console.error('[TWITCH SCRAPER] GraphQL errors for user:', { username: username, errors: result.errors });
                return { isLive: false, error: 'GraphQL API error' };
            }

            const user = result.data.user;
            
            if (!user) {
                console.log('[TWITCH SCRAPER] User not found:', { username: username });
                return { isLive: false, error: 'User not found' };
            }

            const stream = user.stream;
            
            // Improved stream detection based on your examples
            // Stream is live if:
            // 1. stream object exists AND
            // 2. Has stream-specific fields like title, viewersCount, etc.
            const isLive = !!(stream && (
                stream.title || 
                stream.viewersCount !== undefined || 
                stream.game || 
                stream.createdAt
            ));

            // Calculate uptime if live
            let uptime = null;
            if (stream && isLive && stream.createdAt) {
                try {
                    const start = new Date(stream.createdAt);
                    const now = new Date();
                    uptime = Math.floor((now - start) / 60000); // uptime in minutes
                } catch (error) {
                    console.warn(`[TWITCH SCRAPER] Error calculating uptime for ${username}:`, error.message);
                    uptime = null;
                }
            }

            const streamData = {
                isLive: isLive,
                title: stream?.title || null, // Don't use displayName as fallback for title
                game: stream?.game?.displayName || stream?.game?.name || null,
                viewers: stream?.viewersCount !== undefined ? stream.viewersCount : null,
                thumbnail: stream?.game?.boxArtURL || null,
                profileImage: user.profileImageURL || null,
                uptime: uptime,
                tags: stream?.tags?.map(tag => tag.localizedName) || [],
                isPartner: user.roles?.isPartner || false,
                isAffiliate: user.roles?.isAffiliate || false,
                streamId: stream?.id || null,
                error: null
            };

            // No caching - return fresh data immediately
            return streamData;

        } catch (error) {
            console.error('[TWITCH SCRAPER] Error checking user via GraphQL:', { username: username, error: error.message });
            // Return error immediately without caching
            return { isLive: false, error: error.message };
        }
    }

    // Validate stream data before sending notification
    validateStreamData(streamData, username) {
        // Must be live
        if (!streamData.isLive) {
            console.log(`[TWITCH SCRAPER] ${username} - Not live, skipping notification`);
            return false;
        }

        // Must have basic stream information
        const hasTitle = streamData.title && streamData.title !== username; // Title should be more than just username
        const hasViewers = streamData.viewers !== null && streamData.viewers !== undefined;
        const hasUptime = streamData.uptime !== null && streamData.uptime !== undefined;
        const hasStreamId = streamData.streamId !== null && streamData.streamId !== undefined;

        // Log what data we have
        console.log(`[TWITCH SCRAPER] ${username} validation:`, {
            hasTitle,
            hasViewers,
            hasUptime,
            hasStreamId,
            title: streamData.title,
            viewers: streamData.viewers,
            uptime: streamData.uptime,
            game: streamData.game
        });

        // Require at least title AND (viewers OR uptime OR streamId)
        // This ensures we have actual stream data, not just user profile data
        const isValid = hasTitle && (hasViewers || hasUptime || hasStreamId);
        
        if (!isValid) {
            console.log(`[TWITCH SCRAPER] ${username} - Insufficient stream data for notification`);
        }

        return isValid;
    }

    // Send live notification
    async sendLiveNotification(channel, streamer, streamData) {
        try {
            // Double-check that we still have valid data
            if (!this.validateStreamData(streamData, streamer.username)) {
                console.log(`[TWITCH SCRAPER] Stream data validation failed for ${streamer.username}, aborting notification`);
                return;
            }

            console.log(`[TWITCH SCRAPER] Sending notification for ${streamer.username}`);

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
                    name: 'Playing',
                    value: streamData.game,
                    inline: true
                });
            }

            // Add viewer count if available
            if (streamData.viewers !== null && streamData.viewers !== undefined) {
                embed.addFields({
                    name: 'Viewers',
                    value: streamData.viewers.toLocaleString(),
                    inline: true
                });
            }

            // Add uptime if available
            if (streamData.uptime !== null && streamData.uptime !== undefined) {
                const hours = Math.floor(streamData.uptime / 60);
                const minutes = streamData.uptime % 60;
                const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                embed.addFields({
                    name: 'Uptime',
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
            console.log(`[TWITCH SCRAPER] Successfully sent notification for ${streamer.username}`);
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
