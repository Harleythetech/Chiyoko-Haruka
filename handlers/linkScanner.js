const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Discord Link Scanner using Direct Blocklist Fetching
 * Fetches and uses multiple curated blocklists for comprehensive protection
 * 
 * Features:
 * - Direct blocklist fetching from GitHub sources
 * - Multiple curated lists including Discord-AntiScam and StevenBlack hosts
 * - LRU caching for performance and memory efficiency
 * - Comprehensive scam pattern detection
 * - JSON-based source management
 * - WebUI for CRUD operations
 */
class LinkScanner {
    constructor() {
        // Initialize basic properties
        this.sourcesFile = path.join(__dirname, 'linkScannerSources.json');
        this.sources = { sources: [], lastModified: null };
        this.blocklistLastUpdate = 0;
        this.blocklistTTL = 60 * 60 * 1000; // 1 hour
        this.isInitialized = false;
        
        // Initialize caches (will be created lazily)
        this.domainCache = null;
        this.blocklistCache = null;
        
        // Load sources and initialize the scanner
        this.loadSources();
        this.initializeScanner();
    }
    
    /**
     * Lazy initialization of caches
     */
    initializeCaches() {
        if (this.domainCache && this.blocklistCache) {
            return; // Already initialized
        }
        
        try {
            // Try to get memory manager - it might not be available during early startup
            const memoryManager = require('./memoryManager');
            
            // Create LRU cache for domain checks (5 minutes TTL, max 1000 entries)
            this.domainCache = memoryManager.createLRUCache('linkScanner-domains', {
                max: 1000,
                ttl: 5 * 60 * 1000, // 5 minutes
                allowStale: false
            });
            
            // Create LRU cache for blocklists with source tracking (1 hour TTL, max 500000 entries)
            this.blocklistCache = memoryManager.createLRUCache('linkScanner-blocklist', {
                max: 500000,
                ttl: 60 * 60 * 1000, // 1 hour
                allowStale: true
            });
            
        } catch (error) {
            // Fallback to Map-based caches if memory manager is not available
            console.warn('[LINK SCANNER] Memory manager not available, using fallback caches');
            this.domainCache = new Map();
            this.blocklistCache = new Map();
        }
    }

    /**
     * Load sources from JSON file
     */
    loadSources() {
        try {
            if (fs.existsSync(this.sourcesFile)) {
                const data = fs.readFileSync(this.sourcesFile, 'utf8');
                this.sources = JSON.parse(data);
            } else {
                console.warn('[LINK SCANNER] Sources file not found, using empty sources list');
            }
        } catch (error) {
            console.error('[LINK SCANNER] Failed to load sources:', error.message);
            this.sources = { sources: [], lastModified: null };
        }
    }

    /**
     * Save sources to JSON file
     */
    saveSources() {
        try {
            this.sources.lastModified = new Date().toISOString();
            fs.writeFileSync(this.sourcesFile, JSON.stringify(this.sources, null, 2));
            return true;
        } catch (error) {
            console.error('[LINK SCANNER] Failed to save sources:', error.message);
            return false;
        }
    }

    /**
     * Get all sources
     */
    getSources() {
        return this.sources.sources;
    }

    /**
     * Add a new source
     */
    addSource(sourceData) {
        const newSource = {
            id: sourceData.id || `source-${Date.now()}`,
            url: sourceData.url,
            name: sourceData.name,
            type: sourceData.type || 'domain',
            description: sourceData.description || '',
            enabled: sourceData.enabled !== false,
            addedAt: new Date().toISOString(),
            lastUpdated: null
        };

        // Check if source already exists
        const existingIndex = this.sources.sources.findIndex(s => s.id === newSource.id || s.url === newSource.url);
        if (existingIndex !== -1) {
            throw new Error('Source with this ID or URL already exists');
        }

        this.sources.sources.push(newSource);
        
        if (this.saveSources()) {
            // Invalidate cache to force refresh
            this.blocklistLastUpdate = 0;
            return newSource;
        }
        
        throw new Error('Failed to save source');
    }

    /**
     * Update an existing source
     */
    updateSource(id, updateData) {
        const sourceIndex = this.sources.sources.findIndex(s => s.id === id);
        if (sourceIndex === -1) {
            throw new Error('Source not found');
        }

        const source = this.sources.sources[sourceIndex];
        
        // Update allowed fields
        if (updateData.name !== undefined) source.name = updateData.name;
        if (updateData.url !== undefined) source.url = updateData.url;
        if (updateData.type !== undefined) source.type = updateData.type;
        if (updateData.description !== undefined) source.description = updateData.description;
        if (updateData.enabled !== undefined) source.enabled = updateData.enabled;
        
        if (this.saveSources()) {
            // Invalidate cache to force refresh
            this.blocklistLastUpdate = 0;
            return source;
        }
        
        throw new Error('Failed to save source');
    }

    /**
     * Delete a source
     */
    deleteSource(id) {
        const sourceIndex = this.sources.sources.findIndex(s => s.id === id);
        if (sourceIndex === -1) {
            throw new Error('Source not found');
        }

        const deletedSource = this.sources.sources.splice(sourceIndex, 1)[0];
        
        if (this.saveSources()) {
            // Invalidate cache to force refresh
            this.blocklistLastUpdate = 0;
            return deletedSource;
        }
        
        throw new Error('Failed to save sources');
    }

    /**
     * Initialize the link scanner by fetching blocklists
     */
    async initializeScanner() {
        try {
            // Initialize caches first
            this.initializeCaches();
            
            await this.updateBlocklists();
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('[LINK SCANNER] Failed to initialize:', error.message);
            this.isInitialized = false;
        }
    }

    /**
     * Fetch and update all blocklists
     */
    async updateBlocklists() {
        const now = Date.now();
        
        // Check if cache is still valid
        if (this.blocklistLastUpdate > 0 && (now - this.blocklistLastUpdate) < this.blocklistTTL) {
            return; // Cache still valid
        }
        
        // Ensure caches are initialized
        this.initializeCaches();
        
        // Clear cache using appropriate method
        if (typeof this.blocklistCache.clear === 'function') {
            this.blocklistCache.clear();
        } else {
            // Fallback for Map-based cache
            this.blocklistCache.clear();
        }
        
        // Get enabled sources only
        const enabledSources = this.sources.sources.filter(source => source.enabled);
        
        for (const listConfig of enabledSources) {
            try {
                const response = await fetch(listConfig.url, {
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Chiyoko-Haruka Discord Bot - Link Scanner v5.0'
                    }
                });
                
                if (response.ok) {
                    const content = await response.text();
                    const domains = this.parseBlocklist(content, listConfig.url);
                    
                    domains.forEach(domain => {
                        if (domain) {
                            this.blocklistCache.set(domain.toLowerCase(), {
                                source: listConfig.name,
                                type: listConfig.type
                            });
                        }
                    });

                    // Update last updated timestamp for this source
                    const sourceIndex = this.sources.sources.findIndex(s => s.id === listConfig.id);
                    if (sourceIndex !== -1) {
                        this.sources.sources[sourceIndex].lastUpdated = new Date().toISOString();
                    }
                    
                } else {
                    console.warn(`[LINK SCANNER] Failed to fetch ${listConfig.url}: ${response.status}`);
                }
                
            } catch (error) {
                console.error(`[LINK SCANNER] Error fetching ${listConfig.url}:`, error.message);
            }
        }
        
        this.blocklistLastUpdate = now;
        
        // Save updated timestamps
        this.saveSources();
        
        // Trigger garbage collection after major cache update
        if (global.gc) {
            global.gc();
        }
    }

    /**
     * Parse different blocklist formats
     */
    parseBlocklist(content, sourceUrl) {
        const domains = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
                continue;
            }
            
            let domain = null;
            
            // Handle different formats
            if (sourceUrl.includes('StevenBlack/hosts')) {
                // Hosts file format: "0.0.0.0 domain.com"
                const hostsMatch = trimmed.match(/^(?:0\.0\.0\.0|127\.0\.0\.1|::1?)\s+(.+)$/);
                if (hostsMatch && hostsMatch[1]) {
                    domain = hostsMatch[1];
                }
            } else if (sourceUrl.includes('Discord-AntiScam')) {
                // Plain domain list
                if (this.isValidDomain(trimmed)) {
                    domain = trimmed;
                }
            } else if (sourceUrl.includes('hagezi')) {
                // AdBlock format or plain domains
                if (trimmed.startsWith('||') && trimmed.endsWith('^')) {
                    // AdBlock format: "||domain.com^"
                    domain = trimmed.slice(2, -1);
                } else if (this.isValidDomain(trimmed)) {
                    // Plain domain
                    domain = trimmed;
                }
            } else {
                // Generic parsing - try adblock format first, then plain domain
                if (trimmed.startsWith('||') && trimmed.endsWith('^')) {
                    domain = trimmed.slice(2, -1);
                } else if (this.isValidDomain(trimmed)) {
                    domain = trimmed;
                }
            }
            
            // Clean up domain
            if (domain) {
                domain = domain.toLowerCase()
                    .replace(/^www\./, '') // Remove www prefix
                    .replace(/[^a-z0-9.-]/g, '') // Remove invalid chars
                    .trim();
                
                if (this.isValidDomain(domain)) {
                    domains.push(domain);
                }
            }
        }
        
        return domains;
    }

    /**
     * Validate if a string is a valid domain
     */
    isValidDomain(domain) {
        if (!domain || domain.length < 3 || domain.length > 253) {
            return false;
        }
        
        // Basic domain validation
        const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
        return domainRegex.test(domain) && domain.includes('.');
    }

    /**
     * Check if a domain is blocked and return detailed information
     */
    async isDomainBlocked(domain) {
        // Ensure caches are initialized
        this.initializeCaches();
        
        // Check cache first
        const cacheKey = domain.toLowerCase();
        const cached = this.domainCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Update blocklists if needed
        await this.updateBlocklists();

        let result = {
            isBlocked: false,
            source: null,
            type: null,
            matchedDomain: null
        };

        // Check against blocklist cache
        const blocklistResult = this.blocklistCache.get(cacheKey);
        
        if (blocklistResult) {
            result = {
                isBlocked: true,
                source: blocklistResult.source,
                type: blocklistResult.type,
                matchedDomain: domain
            };
        }

        // Check subdomains against blocklist
        if (!result.isBlocked) {
            const domainParts = domain.split('.');
            for (let i = 1; i < domainParts.length; i++) {
                const parentDomain = domainParts.slice(i).join('.');
                const parentResult = this.blocklistCache.get(parentDomain);
                if (parentResult) {
                    result = {
                        isBlocked: true,
                        source: parentResult.source,
                        type: parentResult.type,
                        matchedDomain: parentDomain
                    };
                    break;
                }
            }
        }
        // Cache the result
        this.domainCache.set(cacheKey, result);
        return result;
    }

    /**
     * Calculate string similarity using Levenshtein distance
     */
    calculateSimilarity(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        const maxLength = Math.max(str1.length, str2.length);
        return (maxLength - matrix[str2.length][str1.length]) / maxLength;
    }

    /**
     * Set cache entry with expiry
     */
    /**
     * Extract domains from URLs in a message
     */
    extractDomains(message) {
        
        // Match URLs
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
        const urls = message.match(urlRegex) || [];
        
        
        // Extract domains from URLs
        const domains = [];
        for (const url of urls) {
            try {
                const urlObj = new URL(url);
                domains.push(urlObj.hostname.toLowerCase());
            } catch (error) {
                console.error(`[LINK SCANNER DEBUG] Failed to parse URL ${url}:`, error.message);
                // Invalid URL, skip
            }
        }

        // Also check for plain domain mentions
        const domainRegex = /(?:^|\s)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}/gi;
        const plainDomains = message.match(domainRegex) || [];
        
        
        plainDomains.forEach(domain => {
            const cleaned = domain.trim().toLowerCase();
            if (this.isValidDomain(cleaned)) {
                domains.push(cleaned);
            }
        });

        
        // Remove duplicates
        return [...new Set(domains)];
    }

    /**
     * Scan a Discord message for scam links
     */
    async scanMessage(message) {
        const content = message.content;
        const domains = this.extractDomains(content);
        
        if (domains.length === 0) {
            return {
                isScam: false,
                domains: [],
                totalDomains: 0,
                detections: []
            };
        }

        // Check each domain
        const checks = domains.map(domain => this.isDomainBlocked(domain));
        const results = await Promise.all(checks);
        
        const detections = [];
        const blockedDomains = [];
        
        for (let i = 0; i < domains.length; i++) {
            const result = results[i];
            if (result.isBlocked) {
                blockedDomains.push(domains[i]);
                detections.push({
                    domain: domains[i],
                    source: result.source,
                    type: result.type,
                    matchedDomain: result.matchedDomain
                });
            }
        }
        
        return {
            isScam: blockedDomains.length > 0,
            domains: blockedDomains,
            totalDomains: domains.length,
            detections: detections
        };
    }

    /**
     * Create warning embed for scam detection
     */
    createScamWarningEmbed(detections, user) {
        const domainList = detections.map(detection => {
            let emoji = '🚫';
            switch (detection.type) {
                case 'hosts': emoji = '🏠'; break;
                case 'domain': emoji = '🎯'; break;
                case 'adblock': emoji = '🛡️'; break;
                case 'pattern': emoji = '🔍'; break;
            }
            return `${emoji} \`${detection.domain}\` - *${detection.source}*`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚨 Scam/Malicious Link Detected')
            .setDescription(
                `**Blocked domains:**\n${domainList}\n\n` +
                `This message was automatically deleted for containing known scam, phishing, or malicious links.`
            )
            .addFields(
                { name: '⚠️ Warning', value: 'Do not visit these links as they may steal your account or personal information.', inline: false },
                { name: '🛡️ Protection', value: 'This server is protected by automated link scanning using multiple trusted blocklists.', inline: false }
            )
            .setFooter({ text: `Detected for ${user.username}` })
            .setTimestamp();

        return embed;
    }

    /**
     * Get scanner status and statistics
     */
    getStatus() {
        // Ensure caches are initialized
        this.initializeCaches();
        
        const enabledSources = this.sources.sources.filter(s => s.enabled);
        
        // Get cache size safely
        let blocklistCacheSize = 0;
        let domainCacheSize = 0;
        
        try {
            blocklistCacheSize = this.blocklistCache ? this.blocklistCache.size : 0;
            domainCacheSize = this.domainCache ? this.domainCache.size : 0;
        } catch (error) {
            // Ignore cache size errors
        }
        
        return {
            initialized: this.isInitialized,
            totalBlockedDomains: blocklistCacheSize,
            cacheEntries: domainCacheSize,
            lastBlocklistUpdate: new Date(this.blocklistLastUpdate).toISOString(),
            totalSources: this.sources.sources.length,
            enabledSources: enabledSources.length,
            sources: this.sources.sources
        };
    }
}

// Export singleton instance
module.exports = new LinkScanner();
