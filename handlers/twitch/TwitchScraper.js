const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class TwitchScraper {
    constructor() {
        this.checkInterval = 60000; // 1 minute
        this.intervalId = null;
        this.dataFile = path.join(__dirname, 'twitchData.json');
        this.data = { guilds: {} };
        this.loadData();
    }

    // Load data from JSON file
    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const rawData = fs.readFileSync(this.dataFile, 'utf8');
                this.data = JSON.parse(rawData);
            } else {
                console.warn('[TWITCH SCRAPER] No existing data file found, creating new one');
                this.saveData();
            }
        } catch (error) {
            console.error('[TWITCH SCRAPER] Error loading data:', error);
            this.data = { guilds: {} };
        }
    }

    // Save data to JSON file
    saveData() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[TWITCH SCRAPER] Error saving data:', error);
        }
    }

    // Start monitoring (Discord bot integration)
    startMonitoring(client) {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        
        this.intervalId = setInterval(async () => {
            await this.checkAllStreamers(client);
        }, this.checkInterval);

        // Do an initial check
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

            this.saveData();

            // Only notify on status change
            if (wasLive !== isNowLive) {
                if (isNowLive) {
                    // Going live
                    await this.sendLiveNotification(notificationChannel, streamer, streamData);
                }
            }
        } catch (error) {
            console.error(`[TWITCH SCRAPER] Error checking streamer ${streamer.username}:`, error);
        }
    }

    // Optimized scraping method focusing only on effective detection patterns
    async checkIfLive(username) {
        try {
            const url = `https://www.twitch.tv/${username}`;
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            };

            const response = await axios.get(url, { 
                headers,
                timeout: 10000,
                validateStatus: function (status) {
                    return status < 500; // Accept anything less than 500 as success
                }
            });

            if (response.status === 404) {
                return { isLive: false, error: 'User not found' };
            }

            const $ = cheerio.load(response.data);
            
            // Use optimized detection method
            const detectionResults = this.detectLiveStatus(response.data, username);
            const isLive = detectionResults.isLive;
            
            let streamData = {
                isLive: isLive,
                title: null,
                game: null,
                viewers: null,
                thumbnail: null,
                profileImage: null,
                detectionDetails: detectionResults
            };

            if (isLive) {
                // Try to extract stream information
                streamData = this.extractStreamInfo($, username);
                streamData.detectionDetails = detectionResults;
            }

            return streamData;

        } catch (error) {
            console.error(`[TWITCH SCRAPER] Error checking ${username}:`, error.message);
            return { isLive: false, error: error.message };
        }
    }

    // Optimized detection focusing only on methods that actually work
    detectLiveStatus(html, username) {        
        const results = {
            isLive: false,
            methods: {
                userSpecificText: false,
                liveBroadcastFlag: false,
                offlineIndicators: false
            },
            details: {}
        };

        const pageText = html.toLowerCase();

        // Method 1: Look for user-specific live text (reliable when present)
        const userSpecificIndicators = [
            `${username.toLowerCase()} is live`,
            `${username.toLowerCase()} is streaming`,
            `${username.toLowerCase()} is currently live`,
            `${username.toLowerCase()} - live`,
            `${username.toLowerCase()} • live`,
            `${username.toLowerCase()} live`
        ];

        let userSpecificFound = [];
        const hasUserSpecificText = userSpecificIndicators.some(indicator => {
            const found = pageText.includes(indicator);
            if (found) {
                userSpecificFound.push(indicator);
            }
            return found;
        });

        results.methods.userSpecificText = hasUserSpecificText;
        results.details.userSpecificTextFound = userSpecificFound;

        // Method 2: Check for isLiveBroadcast flag (CRITICAL - only reliable differentiator)
        const liveBroadcastPatterns = [
            '"isLiveBroadcast":true',
            '"isLiveBroadcast": true',
            'isLiveBroadcast:true',
            'isLiveBroadcast: true'
        ];

        let broadcastPatternsFound = [];
        const hasLiveBroadcastFlag = liveBroadcastPatterns.some(pattern => {
            const found = html.includes(pattern);
            if (found) {
                broadcastPatternsFound.push(pattern);
            }
            return found;
        });

        results.methods.liveBroadcastFlag = hasLiveBroadcastFlag;
        results.details.liveBroadcastPatternsFound = broadcastPatternsFound;

        // Method 3: Check for offline indicators (helps reduce false positives)
        const offlineIndicators = [
            `${username.toLowerCase()} is offline`,
            `${username.toLowerCase()} is not streaming`,
            `${username.toLowerCase()} was last seen`,
            'currently offline',
            'not streaming right now',
            'stream is offline'
        ];

        let offlineIndicatorsFound = [];
        const hasOfflineIndicators = offlineIndicators.some(indicator => {
            const found = pageText.includes(indicator);
            if (found) {
                offlineIndicatorsFound.push(indicator);
            }
            return found;
        });

        results.methods.offlineIndicators = hasOfflineIndicators;
        results.details.offlineIndicatorsFound = offlineIndicatorsFound;

        // Optimized evidence scoring - focus on what actually works
        let evidenceScore = 0;
        let criticalEvidence = false;
        let evidenceDetails = [];

        // Live broadcast flag (CRITICAL - this is the key differentiator)
        if (hasLiveBroadcastFlag) {
            evidenceScore += 10;
            criticalEvidence = true;
            evidenceDetails.push('live_broadcast_flag(+10)');
        }

        // User-specific text (strong evidence when present)
        if (hasUserSpecificText) {
            evidenceScore += 5;
            criticalEvidence = true;
            evidenceDetails.push('user_specific_text(+5)');
        }

        // Offline indicators (penalty)
        if (hasOfflineIndicators) {
            evidenceScore -= 3;
            evidenceDetails.push('offline_indicators(-3)');
        }

        // Simple decision logic: Need critical evidence (live broadcast flag OR user-specific text)
        const isLive = criticalEvidence && evidenceScore >= 5;
        results.isLive = isLive;


        // Store simplified evidence details
        results.evidenceAnalysis = {
            score: evidenceScore,
            criticalEvidence: criticalEvidence,
            details: evidenceDetails,
            method: hasLiveBroadcastFlag ? 'live_broadcast_flag' : (hasUserSpecificText ? 'user_specific_text' : 'none')
        };

        return results;
    }

    // Extract stream information when live
    extractStreamInfo($, username) {
        let streamData = {
            isLive: true,
            title: null,
            game: null,
            viewers: null,
            thumbnail: null,
            profileImage: null
        };

        try {
            // Try to get stream title from meta tags (most reliable)
            streamData.title = $('meta[property="og:title"]').attr('content') || 
                              $('meta[name="twitter:title"]').attr('content') || 
                              $('title').text();

            // Try to get stream description/game
            streamData.game = $('meta[property="og:description"]').attr('content') || 
                             $('meta[name="twitter:description"]').attr('content');

            // Try to get thumbnail
            streamData.thumbnail = $('meta[property="og:image"]').attr('content') || 
                                  $('meta[name="twitter:image"]').attr('content');

            // Clean up title if it contains "- Twitch"
            if (streamData.title && streamData.title.includes(' - Twitch')) {
                streamData.title = streamData.title.replace(' - Twitch', '');
            }

        } catch (error) {
            console.error(`[TWITCH SCRAPER] Error extracting stream info for ${username}:`, error.message);
        }

        return streamData;
    }

    // Send live notification
    async sendLiveNotification(channel, streamer, streamData) {
        try {
            const embed = {
                color: 0x9146FF,
                title: `🔴 ${streamer.displayName || streamer.username} is now live!`,
                url: `https://www.twitch.tv/${streamer.username}`,
                description: streamData.title || 'No title available',
                fields: [
                    {
                        name: 'Game/Category',
                        value: streamData.game || 'Not specified',
                        inline: true
                    },
                    {
                        name: 'Viewers',
                        value: streamData.viewers || 'Unknown',
                        inline: true
                    }
                ],
                thumbnail: {
                    url: streamData.profileImage || `https://static-cdn.jtvnw.net/jtv_user_pictures/${streamer.username}-profile_image-70x70.png`
                },
                image: {
                    url: streamData.thumbnail
                },
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Chiyoko Haruka • Twitch Notifications',
                    icon_url: 'https://cdn.discordapp.com/attachments/1107342946535223398/1107343117522821140/haruka.png'
                }
            };

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`[TWITCH SCRAPER] Error sending notification for ${streamer.username}:`, error);
        }
    }

    // Add streamer to monitoring
    addStreamer(guildId, channelId, username, displayName = null) {
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
            displayName: displayName || username,
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
        return this.data.guilds[guildId]?.streamers || [];
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
