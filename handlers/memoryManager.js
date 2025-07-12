const { LRUCache } = require('lru-cache');

/**
 * Memory Management Utility for Chiyoko-Haruka
 * Provides garbage collection, LRU caching, and memory optimization features
 */
class MemoryManager {
    constructor() {
        this.caches = new Map();
        this.weakMaps = new Map();
        this.gcInterval = null;
        this.gcStats = {
            totalCollections: 0,
            totalMemoryFreed: 0,
            lastCollection: null,
            avgCollectionTime: 0
        };
        
        // Memory thresholds (in MB)
        this.memoryThresholds = {
            warning: 180,  // 180MB warning
            critical: 200, // 200MB critical
            emergency: 215 // 215MB emergency (near restart limit)
        };
        
        this.initializeGarbageCollection();
    }

    /**
     * Safe logging function that handles cases where global.reportLog might not be available
     */
    safeLog(message, context = 'Memory', module = 'MemoryManager') {
        if (typeof global.reportLog === 'function') {
            global.reportLog(message, context, module);
        } else {
            console.log(`[${module.toUpperCase()} | ${new Date().toLocaleString()}] | ${context.toUpperCase()} | ${message}`);
        }
    }

    /**
     * Safe error logging function that handles cases where global.reportError might not be available
     */
    safeError(error, context = 'Memory', module = 'MemoryManager') {
        if (typeof global.reportError === 'function') {
            global.reportError(error, context, module);
        } else {
            console.error(`[${module.toUpperCase()}] [${new Date().toLocaleString()}] ${context.toUpperCase()} | ${error}`);
        }
    }

    /**
     * Create a new LRU cache with specified options
     */
    createLRUCache(name, options = {}) {
        const defaultOptions = {
            max: 500,
            ttl: 1000 * 60 * 30, // 30 minutes default TTL
            allowStale: false,
            updateAgeOnGet: true,
            dispose: (value, key, reason) => {
                // Clean up disposed values
                if (value && typeof value.cleanup === 'function') {
                    value.cleanup();
                }
            }
        };

        const cache = new LRUCache({ ...defaultOptions, ...options });
        this.caches.set(name, cache);
        
        this.safeLog(`Created LRU cache: ${name} (max: ${cache.max}, ttl: ${cache.ttl}ms)`, 'Memory', 'MemoryManager');
        return cache;
    }

    /**
     * Get an existing cache by name
     */
    getCache(name) {
        return this.caches.get(name);
    }

    /**
     * Create a WeakMap for temporary object associations
     */
    createWeakMap(name) {
        const weakMap = new WeakMap();
        this.weakMaps.set(name, weakMap);
        this.safeLog(`Created WeakMap: ${name}`, 'Memory', 'MemoryManager');
        return weakMap;
    }

    /**
     * Get an existing WeakMap by name
     */
    getWeakMap(name) {
        return this.weakMaps.get(name);
    }

    /**
     * Initialize garbage collection monitoring
     */
    initializeGarbageCollection() {
        // Force garbage collection every 2 minutes
        this.gcInterval = setInterval(() => {
            this.performGarbageCollection();
        }, 120000); // 2 minutes

        // Monitor memory usage every 30 seconds
        setInterval(() => {
            this.monitorMemoryUsage();
        }, 30000); // 30 seconds

        this.safeLog('Garbage collection monitoring initialized', 'Init', 'MemoryManager');
    }

    /**
     * Perform garbage collection and cleanup
     */
    performGarbageCollection() {
        const startTime = Date.now();
        const memBefore = process.memoryUsage();

        try {
            // Clear expired cache entries
            this.cleanupCaches();
            
            // Force Node.js garbage collection if available
            if (global.gc) {
                global.gc();
            }

            // Clean up module caches for non-essential modules
            this.cleanupModuleCache();
            
            // Clear temporary download files
            this.cleanupTemporaryFiles();

            const memAfter = process.memoryUsage();
            const collectionTime = Date.now() - startTime;
            const memoryFreed = memBefore.heapUsed - memAfter.heapUsed;

            // Update stats
            this.gcStats.totalCollections++;
            this.gcStats.totalMemoryFreed += Math.max(0, memoryFreed);
            this.gcStats.lastCollection = new Date().toISOString();
            this.gcStats.avgCollectionTime = 
                (this.gcStats.avgCollectionTime * (this.gcStats.totalCollections - 1) + collectionTime) / 
                this.gcStats.totalCollections;

            const memoryFreedMB = (memoryFreed / 1024 / 1024).toFixed(2);
            this.safeLog(
                `GC completed: ${memoryFreedMB}MB freed, took ${collectionTime}ms`, 
                'GarbageCollection', 
                'MemoryManager'
            );

        } catch (error) {
            this.safeError(error, 'GarbageCollection', 'MemoryManager');
        }
    }

    /**
     * Clean up expired entries from all LRU caches
     */
    cleanupCaches() {
        let totalCleared = 0;
        
        for (const [name, cache] of this.caches) {
            const sizeBefore = cache.size;
            
            // Force cleanup of expired entries
            cache.purgeStale();
            
            // If cache is over 80% full, clear oldest 20%
            if (cache.size > cache.max * 0.8) {
                const entriesToClear = Math.floor(cache.size * 0.2);
                const keys = [...cache.keys()];
                for (let i = 0; i < entriesToClear && i < keys.length; i++) {
                    cache.delete(keys[i]);
                }
            }
            
            const sizeAfter = cache.size;
            const cleared = sizeBefore - sizeAfter;
            totalCleared += cleared;
            
            if (cleared > 0) {
                this.safeLog(
                    `Cache ${name}: cleared ${cleared} entries (${sizeBefore} -> ${sizeAfter})`, 
                    'CacheCleanup', 
                    'MemoryManager'
                );
            }
        }

        return totalCleared;
    }

    /**
     * Clean up Node.js module cache for non-essential modules
     */
    cleanupModuleCache() {
        const modulesToKeep = [
            'discord.js', '@discordjs/voice', 'express', 'socket.io',
            'fs', 'path', 'os', 'util', 'events', 'stream',
            'lru-cache'
        ];

        let cleared = 0;
        for (const modulePath in require.cache) {
            // Skip essential modules
            const shouldKeep = modulesToKeep.some(essential => 
                modulePath.includes(essential) || 
                modulePath.includes('node_modules/' + essential)
            );

            // Skip modules in our project directory
            const isProjectModule = modulePath.includes(process.cwd());

            if (!shouldKeep && !isProjectModule) {
                delete require.cache[modulePath];
                cleared++;
            }
        }

        if (cleared > 0) {
            this.safeLog(`Cleared ${cleared} non-essential modules from cache`, 'ModuleCleanup', 'MemoryManager');
        }

        return cleared;
    }

    /**
     * Clean up temporary files from downloads directory
     */
    cleanupTemporaryFiles() {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const downloadsDir = path.join(process.cwd(), 'downloads');
            if (!fs.existsSync(downloadsDir)) return;

            const files = fs.readdirSync(downloadsDir);
            const now = Date.now();
            let cleaned = 0;

            for (const file of files) {
                const filePath = path.join(downloadsDir, file);
                const stats = fs.statSync(filePath);
                
                // Delete files older than 1 hour
                if (now - stats.mtime.getTime() > 3600000) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                this.safeLog(`Cleaned ${cleaned} temporary files`, 'FileCleanup', 'MemoryManager');
            }

        } catch (error) {
            this.safeError(error, 'FileCleanup', 'MemoryManager');
        }
    }

    /**
     * Monitor memory usage and trigger emergency cleanup if needed
     */
    monitorMemoryUsage() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        const rssMB = memUsage.rss / 1024 / 1024;

        // Check thresholds
        if (rssMB > this.memoryThresholds.emergency) {
            this.safeError(
                `EMERGENCY: Memory usage at ${rssMB.toFixed(2)}MB (limit: ${this.memoryThresholds.emergency}MB)`,
                'MemoryEmergency',
                'MemoryManager'
            );
            this.emergencyCleanup();
        } else if (rssMB > this.memoryThresholds.critical) {
            this.safeError(
                `CRITICAL: Memory usage at ${rssMB.toFixed(2)}MB`,
                'MemoryCritical',
                'MemoryManager'
            );
            this.performGarbageCollection();
        } else if (rssMB > this.memoryThresholds.warning) {
            this.safeLog(
                `WARNING: Memory usage at ${rssMB.toFixed(2)}MB`,
                'MemoryWarning',
                'MemoryManager'
            );
        }
    }

    /**
     * Emergency cleanup when memory is critically low
     */
    emergencyCleanup() {
        this.safeLog('Performing emergency memory cleanup', 'EmergencyCleanup', 'MemoryManager');

        try {
            // Clear all caches aggressively
            for (const [name, cache] of this.caches) {
                const sizeBefore = cache.size;
                cache.clear();
                this.safeLog(`Emergency: Cleared cache ${name} (${sizeBefore} entries)`, 'EmergencyCleanup', 'MemoryManager');
            }

            // Force multiple GC cycles
            if (global.gc) {
                for (let i = 0; i < 3; i++) {
                    global.gc();
                }
            }

            // Clear more of the module cache
            const cleared = this.cleanupModuleCache();
            
            // Clean all temporary files
            this.cleanupTemporaryFiles();

            this.safeLog('Emergency cleanup completed', 'EmergencyCleanup', 'MemoryManager');

        } catch (error) {
            this.safeError(error, 'EmergencyCleanup', 'MemoryManager');
        }
    }

    /**
     * Get memory statistics
     */
    getMemoryStats() {
        const memUsage = process.memoryUsage();
        const cacheStats = {};
        
        for (const [name, cache] of this.caches) {
            cacheStats[name] = {
                size: cache.size,
                max: cache.max,
                ttl: cache.ttl
            };
        }

        return {
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
                external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
            },
            caches: cacheStats,
            weakMaps: this.weakMaps.size,
            gc: this.gcStats,
            thresholds: this.memoryThresholds
        };
    }

    /**
     * Shutdown cleanup
     */
    shutdown() {
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
        }
        
        // Clear all caches
        for (const cache of this.caches.values()) {
            cache.clear();
        }
        
        this.safeLog('Memory manager shutdown completed', 'Shutdown', 'MemoryManager');
    }
}

// Export singleton instance
module.exports = new MemoryManager();
