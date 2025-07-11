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
 * - Local caching for performance
 * - Comprehensive scam pattern detection
 * - JSON-based source management
 * - WebUI for CRUD operations
 */
class LinkScanner {
    constructor() {
        // Cache for domain checks (5 minutes TTL)
        this.domainCache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        
        // Sources file path
        this.sourcesFile = path.join(__dirname, 'linkScannerSources.json');
        this.sources = { sources: [], lastModified: null };
        
        // Cache for blocklists with source tracking (refresh every hour)
        this.blocklistCache = new Map(); // domain -> {source: 'list name', type: 'detection type'}
        this.blocklistLastUpdate = 0;
        this.blocklistTTL = 60 * 60 * 1000; // 1 hour
        
        this.isInitialized = false;
        
        // Load sources and initialize the scanner
        this.loadSources();
        this.initializeScanner();
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
        
        this.blocklistCache.clear();
        
        // Get enabled sources only
        const enabledSources = this.sources.sources.filter(source => source.enabled);
        
        for (const listConfig of enabledSources) {
            try {
                const response = await fetch(listConfig.url, {
                    timeout: 10000,
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
     * Check if a domain is blocked
     */
    /**
     * Check if a domain is blocked and return detailed information
     */
    async isDomainBlocked(domain) {
        // Check cache first
        const cacheKey = domain.toLowerCase();
        const cached = this.domainCache.get(cacheKey);
        if (cached && Date.now() < cached.expiry) {
            return cached.result;
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
        if (this.blocklistCache.has(cacheKey)) {
            const sourceInfo = this.blocklistCache.get(cacheKey);
            result = {
                isBlocked: true,
                source: sourceInfo.source,
                type: sourceInfo.type,
                matchedDomain: domain
            };
        }

        // Check subdomains against blocklist
        if (!result.isBlocked) {
            const domainParts = domain.split('.');
            for (let i = 1; i < domainParts.length; i++) {
                const parentDomain = domainParts.slice(i).join('.');
                if (this.blocklistCache.has(parentDomain)) {
                    const sourceInfo = this.blocklistCache.get(parentDomain);
                    result = {
                        isBlocked: true,
                        source: sourceInfo.source,
                        type: sourceInfo.type,
                        matchedDomain: parentDomain
                    };
                    break;
                }
            }
        }

        // Fallback to heuristic check if not in blocklists
        if (!result.isBlocked) {
            const heuristicBlocked = this.checkDomainHeuristics(domain);
            if (heuristicBlocked) {
                result = {
                    isBlocked: true,
                    source: 'Heuristic Analysis',
                    type: 'pattern',
                    matchedDomain: domain
                };
            }
        }

        // Cache the result
        this.setCacheEntry(cacheKey, result);
        return result;
    }

    /**
     * Heuristic domain checking for common scam patterns
     */
    checkDomainHeuristics(domain) {
        const suspiciousPatterns = [
            // Discord-related scams
            /discord.*nitro/i,
            /nitro.*discord/i,
            /discord.*gift/i,
            /discord.*free/i,
            /discod/i, // Common typo
            /disocrd/i, // Common typo
            
            // Steam-related scams
            /steam.*community/i,
            /steamcommunity.*[^.]/i, // Not ending with official TLD
            /steam.*gift/i,
            /steam.*free/i,
            /stearn/i, // Common typo
            
            // Generic suspicious patterns
            /free.*nitro/i,
            /claim.*nitro/i,
            /get.*nitro/i,
            /nitro.*claim/i,
            /nitro.*generator/i,
            /nitro.*hack/i,
            
            // Suspicious TLDs and patterns
            /\.(tk|ml|ga|cf)$/i, // Free suspicious TLDs
            /.*-nitro-/i,
            /.*\.nitro\./i,
            /discord-app.*\.com/i, // Fake Discord app domains
            
            // URL shorteners commonly used for scams
            /bit\.ly/i,
            /tinyurl/i,
            /t\.co/i,
            /goo\.gl/i,
            /ow\.ly/i
        ];

        // Check for suspicious patterns
        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(domain));
        
        // Additional checks for domain similarity to legitimate services
        if (!isSuspicious) {
            return this.checkDomainSimilarity(domain);
        }
        
        return isSuspicious;
    }

    /**
     * Check for domains that are similar to legitimate services (typosquatting)
     */
    checkDomainSimilarity(domain) {
        const legitimateDomains = [
            'discord.com',
            'discord.gg', 
            'discordapp.com',
            'steampowered.com',
            'steamcommunity.com',
            'youtube.com',
            'google.com',
            'microsoft.com',
            'github.com'
        ];

        for (const legitDomain of legitimateDomains) {
            // Check for character substitution or addition
            const similarity = this.calculateSimilarity(domain, legitDomain);
            if (similarity > 0.8 && domain !== legitDomain) {
                return true;
            }
        }

        return false;
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
     * Set cache entry with expiry
     */
    setCacheEntry(key, result) {
        this.domainCache.set(key, {
            result: result,
            expiry: Date.now() + this.cacheTTL
        });
    }

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
        const enabledSources = this.sources.sources.filter(s => s.enabled);
        return {
            initialized: this.isInitialized,
            totalBlockedDomains: this.blocklistCache.size,
            cacheEntries: this.domainCache.size,
            lastBlocklistUpdate: new Date(this.blocklistLastUpdate).toISOString(),
            totalSources: this.sources.sources.length,
            enabledSources: enabledSources.length,
            sources: this.sources.sources
        };
    }
}

// Export singleton instance
module.exports = new LinkScanner();
