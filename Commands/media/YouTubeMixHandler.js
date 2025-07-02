const ytdl = require('@distube/ytdl-core');
const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const VideoInfoExtractor = require('./VideoInfoExtractor');

// Configure ytdl-core with anti-detection measures
const ytdlOptions = {
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive'
        }
    }
};

/**
 * YouTube Mix Handler - Advanced implementation for handling YouTube Mixes
 * 
 * YouTube Mixes are dynamically generated playlists that don't have a fixed list.
 * This handler implements several strategies to get songs from mixes.
 */
class YouTubeMixHandler {
    constructor() {
        this.mixCache = new Map(); // Cache mix results
        this.videoExtractor = new VideoInfoExtractor();
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
    }

    /**
     * Check if URL is a YouTube Mix
     */
    isYouTubeMix(url) {
        const mixPatterns = [
            /[&?]list=(RD[a-zA-Z0-9_-]+)/,  // Standard mixes
            /[&?]list=(RDMM[a-zA-Z0-9_-]+)/, // Music mixes
            /[&?]list=(RDAO[a-zA-Z0-9_-]+)/, // Artist mixes
            /[&?]list=(RDEM[a-zA-Z0-9_-]+)/, // My Mix
            /start_radio=1/                  // Radio parameter
        ];
        
        return mixPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Extract mix ID and video ID from URL
     */
    extractMixInfo(url) {
        const videoMatch = url.match(/[&?]v=([a-zA-Z0-9_-]{11})/);
        const listMatch = url.match(/[&?]list=([a-zA-Z0-9_-]+)/);
        
        return {
            videoId: videoMatch ? videoMatch[1] : null,
            mixId: listMatch ? listMatch[1] : null,
            originalUrl: url
        };
    }

    /**
     * Method 1: Web scraping approach (most reliable)
     * Scrapes the YouTube page to get the initial mix songs
     */
    async getMixSongsViaWebScraping(url, limit = 25) {
        try {
            const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            
            // Extract ytInitialData from the page
            const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});/);
            if (!ytInitialDataMatch) {
                throw new Error('Could not find ytInitialData');
            }

            const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
            
            // Navigate through the complex YouTube data structure
            const songs = this.extractSongsFromYtData(ytInitialData, limit);
            
            return {
                success: true,
                songs: songs,
                method: 'web-scraping'
            };

        } catch (error) {
            console.error('Web scraping method failed:', error.message);
            return {
                success: false,
                error: error.message,
                method: 'web-scraping'
            };
        }
    }

    /**
     * Method 2: YouTube Internal API approach
     * Uses YouTube's internal API endpoints
     */
    async getMixSongsViaInternalAPI(mixInfo, limit = 25) {
        try {
            // Get the initial page to extract necessary tokens
            const initialResponse = await fetch(mixInfo.originalUrl, {
                headers: {
                    'User-Agent': this.userAgents[0]
                }
            });
            
            const html = await initialResponse.text();
            
            // Extract necessary tokens for API calls
            const clientVersion = html.match(/"clientVersion":"([^"]+)"/)?.[1];
            const clientName = html.match(/"clientName":"([^"]+)"/)?.[1];
            const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
            
            if (!apiKey) {
                throw new Error('Could not extract API key');
            }

            // Make API call to get mix continuation
            const apiUrl = `https://www.youtube.com/youtubei/v1/next?key=${apiKey}`;
            const payload = {
                context: {
                    client: {
                        clientName: clientName || "WEB",
                        clientVersion: clientVersion || "2.20230101.00.00"
                    }
                },
                videoId: mixInfo.videoId,
                playlistId: mixInfo.mixId
            };

            const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': this.userAgents[0]
                },
                body: JSON.stringify(payload)
            });

            if (!apiResponse.ok) {
                throw new Error(`API request failed: ${apiResponse.status}`);
            }

            const apiData = await apiResponse.json();
            const songs = this.extractSongsFromApiData(apiData, limit);

            return {
                success: true,
                songs: songs,
                method: 'internal-api'
            };

        } catch (error) {
            console.error('Internal API method failed:', error.message);
            return {
                success: false,
                error: error.message,
                method: 'internal-api'
            };
        }
    }

    /**
     * Method 3: Related videos approach
     * Gets related videos and builds a mix-like playlist
     */
    async getMixSongsViaRelated(videoId, limit = 25) {
        try {
            const songs = [];
            const processedIds = new Set();
            
            // Start with the original video
            const originalVideo = await this.getVideoInfo(videoId);
            if (originalVideo) {
                songs.push(originalVideo);
                processedIds.add(videoId);
            }

            // Get related videos iteratively
            let currentVideoId = videoId;
            
            while (songs.length < limit) {
                const relatedVideos = await this.getRelatedVideos(currentVideoId);
                
                if (!relatedVideos || relatedVideos.length === 0) {
                    break;
                }

                // Add related videos that we haven't processed
                for (const video of relatedVideos) {
                    if (songs.length >= limit) break;
                    if (!processedIds.has(video.id)) {
                        songs.push(video);
                        processedIds.add(video.id);
                    }
                }

                // Use the last added video to get more related videos
                currentVideoId = songs[songs.length - 1]?.id;
                if (!currentVideoId || processedIds.size > limit * 2) {
                    break; // Prevent infinite loops
                }
            }

            return {
                success: true,
                songs: songs.slice(0, limit),
                method: 'related-videos'
            };

        } catch (error) {
            console.error('Related videos method failed:', error.message);
            return {
                success: false,
                error: error.message,
                method: 'related-videos'
            };
        }
    }

    /**
     * Main method to get mix songs - tries all methods
     */
    async getMixSongs(url, limit = 25) {
        const mixInfo = this.extractMixInfo(url);
        
        if (!mixInfo.videoId) {
            return {
                success: false,
                error: 'Could not extract video ID from mix URL'
            };
        }

        // Check cache first
        const cacheKey = `${mixInfo.mixId}_${mixInfo.videoId}_${limit}`;
        if (this.mixCache.has(cacheKey)) {
            return this.mixCache.get(cacheKey);
        }

        // Try Method 1: Web scraping (most reliable)
        let result = await this.getMixSongsViaWebScraping(url, limit);
        
        if (result.success && result.songs.length > 1) {
            this.mixCache.set(cacheKey, result);
            return result;
        }

        // Try Method 2: Internal API
        result = await this.getMixSongsViaInternalAPI(mixInfo, limit);
        
        if (result.success && result.songs.length > 1) {
            this.mixCache.set(cacheKey, result);
            return result;
        }

        // Try Method 3: Related videos (fallback)
        result = await this.getMixSongsViaRelated(mixInfo.videoId, limit);
        
        if (result.success) {
            this.mixCache.set(cacheKey, result);
            return result;
        }

        // If all methods fail, return just the original video
        try {
            const originalVideo = await this.getVideoInfo(mixInfo.videoId);
            return {
                success: true,
                songs: originalVideo ? [originalVideo] : [],
                method: 'fallback-single-video',
                warning: 'Could not load full mix, playing original video only'
            };
        } catch (error) {
            return {
                success: false,
                error: 'All methods failed to get mix songs'
            };
        }
    }

    /**
     * Extract songs from YouTube's ytInitialData
     */
    extractSongsFromYtData(ytData, limit) {
        const songs = [];
        
        try {
            // Navigate through YouTube's complex data structure
            const contents = ytData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;
            
            if (!contents) {
                throw new Error('Could not find playlist contents in ytInitialData');
            }

            for (const item of contents) {
                if (songs.length >= limit) break;
                
                const videoRenderer = item.playlistPanelVideoRenderer;
                if (!videoRenderer) continue;

                const song = this.extractSongFromRenderer(videoRenderer);
                if (song) {
                    songs.push(song);
                }
            }

        } catch (error) {
            console.error('Error extracting songs from ytData:', error.message);
        }
        
        return songs;
    }

    /**
     * Extract songs from API response data
     */
    extractSongsFromApiData(apiData, limit) {
        const songs = [];
        
        try {
            const contents = apiData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;
            
            if (!contents) {
                throw new Error('Could not find playlist contents in API data');
            }

            for (const item of contents) {
                if (songs.length >= limit) break;
                
                const videoRenderer = item.playlistPanelVideoRenderer;
                if (!videoRenderer) continue;

                const song = this.extractSongFromRenderer(videoRenderer);
                if (song) {
                    songs.push(song);
                }
            }

        } catch (error) {
            console.error('Error extracting songs from API data:', error.message);
        }
        
        return songs;
    }

    /**
     * Extract song info from video renderer object
     */
    extractSongFromRenderer(renderer) {
        try {
            const title = renderer.title?.simpleText || renderer.title?.runs?.[0]?.text;
            const videoId = renderer.videoId;
            const lengthText = renderer.lengthText?.simpleText;
            const thumbnail = renderer.thumbnail?.thumbnails?.[0]?.url;
            
            if (!title || !videoId) {
                return null;
            }

            // Parse duration
            let duration = 0;
            if (lengthText) {
                const parts = lengthText.split(':').reverse();
                for (let i = 0; i < parts.length; i++) {
                    duration += parseInt(parts[i]) * Math.pow(60, i);
                }
            }

            return {
                id: videoId,
                title: title,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                duration: duration,
                thumbnail: thumbnail,
                channel: renderer.longBylineText?.runs?.[0]?.text || 'Unknown'
            };

        } catch (error) {
            console.error('Error extracting song from renderer:', error.message);
            return null;
        }
    }

    /**
     * Get video info using robust extractor
     */
    async getVideoInfo(videoId) {
        try {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const result = await this.videoExtractor.getVideoInfo(videoUrl);
            
            if (result.success) {
                return {
                    id: videoId,
                    title: result.title,
                    url: videoUrl,
                    duration: result.duration,
                    thumbnail: result.thumbnail,
                    channel: result.channel
                };
            } else {
                console.error(`Error getting video info for ${videoId}:`, result.error);
                return null;
            }
        } catch (error) {
            console.error(`Error getting video info for ${videoId}:`, error.message);
            return null;
        }
    }

    /**
     * Get related videos (simplified implementation using robust extractor)
     */
    async getRelatedVideos(videoId) {
        try {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const result = await this.videoExtractor.getVideoInfo(videoUrl);
            
            if (!result.success) {
                console.error(`Error getting video info for related videos: ${result.error}`);
                return [];
            }
            
            // For related videos, we'll try to extract them from the YouTube page
            // This is a simplified approach - in reality, you'd need more complex parsing
            try {
                const info = await ytdl.getInfo(videoUrl, ytdlOptions);
                const relatedVideos = info.related_videos || [];
                
                return relatedVideos.slice(0, 10).map(video => ({
                    id: video.id,
                    title: video.title,
                    url: `https://www.youtube.com/watch?v=${video.id}`,
                    duration: video.length_seconds || 0,
                    thumbnail: video.thumbnail,
                    channel: video.author || 'Unknown'
                }));
            } catch (ytdlError) {
                return [];
            }
            
        } catch (error) {
            console.error(`Error getting related videos for ${videoId}:`, error.message);
            return [];
        }
    }

    /**
     * Create a mix embed for Discord
     */
    createMixEmbed(mixResult, mixInfo) {
        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🎲 YouTube Mix Loaded!')
            .setTimestamp();

        if (mixResult.success) {
            embed.setDescription(`Successfully loaded ${mixResult.songs.length} songs from the mix`);
            embed.addFields(
                { name: '🎵 Songs Loaded', value: `${mixResult.songs.length}`, inline: true },
                { name: '🔧 Method Used', value: mixResult.method, inline: true },
                { name: '🆔 Mix ID', value: mixInfo.mixId || 'Unknown', inline: true }
            );

            if (mixResult.warning) {
                embed.addFields({
                    name: '⚠️ Warning',
                    value: mixResult.warning,
                    inline: false
                });
            }

            // Show first few songs
            if (mixResult.songs.length > 0) {
                const songList = mixResult.songs.slice(0, 5).map((song, index) => 
                    `${index + 1}. ${song.title}`
                ).join('\n');
                
                embed.addFields({
                    name: '📃 Preview',
                    value: songList + (mixResult.songs.length > 5 ? `\n... and ${mixResult.songs.length - 5} more` : ''),
                    inline: false
                });
            }
        } else {
            embed.setDescription('❌ Failed to load YouTube Mix')
                .addFields({
                    name: 'Error',
                    value: mixResult.error,
                    inline: false
                });
        }

        return embed;
    }

    /**
     * Clear cache (call periodically to prevent memory issues)
     */
    clearCache() {
        this.mixCache.clear();
    }
}

module.exports = YouTubeMixHandler;
