const ytdl = require('@distube/ytdl-core');
const fetch = require('node-fetch');

/**
 * Robust Video Info Extractor with multiple fallback methods
 * Handles cases where ytdl-core fails due to YouTube changes
 */
class VideoInfoExtractor {
    constructor() {
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        
        // Add simple cache to prevent redundant calls
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Extract video ID from YouTube URL
     */
    extractVideoId(url) {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    /**
     * Get HD thumbnail for video ID
     */
    getHDThumbnail(videoId) {
        if (!videoId) return null;
        // Use maxresdefault for highest quality (1280x720)
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    /**
     * Method 1: Try ytdl-core with enhanced options
     */
    async getInfoViaYtdl(url) {
        try {
            console.log('Trying ytdl-core method...');
            const info = await ytdl.getInfo(url);
            const videoId = this.extractVideoId(url);
            
            return {
                success: true,
                title: info.videoDetails.title,
                duration: parseInt(info.videoDetails.lengthSeconds),
                thumbnail: this.getHDThumbnail(videoId) || info.videoDetails.thumbnails?.[0]?.url,
                channel: info.videoDetails.author.name,
                url: url,
                method: 'ytdl-core'
            };
        } catch (error) {
            console.log('ytdl-core method failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Method 2: Web scraping approach
     */
    async getInfoViaWebScraping(url) {
        try {
            console.log('Trying web scraping method...');
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
            
            // Extract title from page title or og:title
            let title = 'Unknown Title';
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
                title = titleMatch[1].replace(' - YouTube', '').trim();
            }
            
            // Try og:title as fallback
            const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
            if (ogTitleMatch) {
                title = ogTitleMatch[1];
            }

            // Extract thumbnail - prioritize HD version
            const videoId = this.extractVideoId(url);
            let thumbnail = this.getHDThumbnail(videoId);
            
            // Fallback to og:image if HD thumbnail fails
            if (!thumbnail) {
                const thumbnailMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
                if (thumbnailMatch) {
                    thumbnail = thumbnailMatch[1];
                }
            }

            // Extract channel name
            let channel = 'Unknown Channel';
            const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
            if (channelMatch) {
                channel = channelMatch[1];
            }

            // Extract duration (this is trickier from HTML, so we'll estimate)
            let duration = 0;
            const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
            if (durationMatch) {
                duration = parseInt(durationMatch[1]);
            }

            return {
                success: true,
                title: title,
                duration: duration,
                thumbnail: thumbnail,
                channel: channel,
                url: url,
                method: 'web-scraping'
            };

        } catch (error) {
            console.log('Web scraping method failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Method 3: YouTube oEmbed API (limited info but reliable)
     */
    async getInfoViaOEmbed(url) {
        try {
            console.log('Trying oEmbed method...');
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            
            const response = await fetch(oembedUrl, {
                headers: {
                    'User-Agent': this.userAgents[0]
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // Extract video ID to create HD thumbnail URL
            const videoId = this.extractVideoId(url);
            const hdThumbnail = this.getHDThumbnail(videoId);

            return {
                success: true,
                title: data.title || 'Unknown Title',
                duration: 0, // oEmbed doesn't provide duration
                thumbnail: hdThumbnail || data.thumbnail_url,
                channel: data.author_name || 'Unknown Channel',
                url: url,
                method: 'oembed'
            };

        } catch (error) {
            console.log('oEmbed method failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Method 4: Basic fallback using video ID
     */
    async getInfoViaFallback(url) {
        try {
            console.log('Using basic fallback method...');
            const videoId = this.extractVideoId(url);
            
            if (!videoId) {
                throw new Error('Could not extract video ID');
            }

            return {
                success: true,
                title: `YouTube Video (${videoId})`,
                duration: 0,
                thumbnail: this.getHDThumbnail(videoId),
                channel: 'Unknown Channel',
                url: url,
                method: 'fallback'
            };

        } catch (error) {
            console.log('Fallback method failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Main method - tries all approaches in order with caching
     */
    async getVideoInfo(url) {
        // Check cache first
        const cachedResult = this.cache.get(url);
        if (cachedResult && Date.now() - cachedResult.timestamp < this.cacheTimeout) {
            console.log('Using cached video info');
            return cachedResult.data;
        }
        
        const methods = [
            () => this.getInfoViaYtdl(url),
            () => this.getInfoViaWebScraping(url),
            () => this.getInfoViaOEmbed(url),
            () => this.getInfoViaFallback(url)
        ];

        for (const method of methods) {
            const result = await method();
            if (result.success) {
                console.log(`Successfully extracted video info using: ${result.method}`);
                
                // Cache the result
                this.cache.set(url, {
                    data: result,
                    timestamp: Date.now()
                });
                
                // Clean old cache entries
                this.cleanCache();
                
                return result;
            }
        }

        const failResult = {
            success: false,
            error: 'All methods failed to extract video information'
        };
        
        return failResult;
    }

    /**
     * Clean old cache entries
     */
    cleanCache() {
        const now = Date.now();
        for (const [url, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.cacheTimeout) {
                this.cache.delete(url);
            }
        }
    }

    /**
     * Check if we can create a stream for this URL - simplified approach
     * This method is kept for compatibility but optimized to avoid redundant calls
     */
    async canCreateStream(url) {
        // Simply return true - let the actual streaming handle failures
        // This avoids the redundant getVideoInfo call that was causing delays
        console.log(`Stream capability assumed true for: ${url}`);
        return true;
    }
}

module.exports = VideoInfoExtractor;
