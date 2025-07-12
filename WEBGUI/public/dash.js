// Modern Dashboard JavaScript for Chiyoko Haruka
const socket = io();

// Theme Management
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;

// Initialize theme from localStorage or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
htmlElement.setAttribute('data-bs-theme', savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    htmlElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// Host Information Detection
async function detectHostInfo() {
    try {
        const currentHost = window.location.hostname || 'localhost';
        
        // Set initial values from URL
        const hostNameElement = document.getElementById('hostName');
        const hostIPElement = document.getElementById('hostIP');
        const hostPortElement = document.getElementById('hostPort');
        
        if (hostNameElement) {
            hostNameElement.textContent = 'Loading...';
        }
        
        if (hostIPElement) {
            hostIPElement.textContent = 'Detecting...';
        }
        
        // Update port display
        if (hostPortElement) {
            const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
            hostPortElement.textContent = `:${port}`;
        }
        
        // Set up a fallback timeout in case WebSocket doesn't send host info
        setTimeout(() => {
            if (hostNameElement && hostNameElement.textContent === 'Loading...') {
                // Fallback to URL-based detection
                const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(currentHost);
                
                if (isIPAddress) {
                    if (currentHost === '127.0.0.1' || currentHost === '::1') {
                        hostNameElement.textContent = 'localhost';
                    } else {
                        hostNameElement.textContent = currentHost;
                    }
                } else {
                    hostNameElement.textContent = currentHost;
                }
            }
            
            if (hostIPElement && hostIPElement.textContent === 'Detecting...') {
                const fallbackIP = currentHost === 'localhost' ? '127.0.0.1' : currentHost;
                hostIPElement.textContent = fallbackIP;
            }
        }, 5000); // 5 second timeout
        
    } catch (error) {
        console.error('Failed to detect host info:', error);
        const hostNameElement = document.getElementById('hostName');
        if (hostNameElement) {
            hostNameElement.textContent = 'Unknown Host';
        }
        const hostIPElement = document.getElementById('hostIP');
        if (hostIPElement) {
            hostIPElement.textContent = 'Unknown IP';
        }
    }
}

// Initialize bot status and stats
function initializeDashboard() {
    // Set initial values with null checks
    const elements = {
        'botStatus': 'Connecting...',
        'guildCount': '0',
        'userCount': '0',
        'ping': '0ms',
        'activeMusicCount': '0',
        'cpuValue': '0%',
        'memoryValue': '0%',
        'uptime': '00:00:00',
        'gatewayStatus': 'Connecting...',
        'socketStatus': 'Connecting...',
        'processId': '0',
        'threadCount': '1',
        'nodeVersion': 'Loading...',
        'platform': 'Loading...',
        'architecture': 'Loading...',
        'memoryUsed': '0 MB',
        'memoryTotal': '0 MB',
        'startTime': 'Loading...',
        'twitchStatus': 'Offline',
        'totalStreamers': '0',
        'liveStreamers': '0',
        'twitchGuilds': '0'
    };

    // Initialize all elements with null checks
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });

    // Initialize logs
    addLogEntry('INFO', 'Dashboard initialized');
}

// Socket event handlers for real-time updates

// Receive system hostname information from the server
socket.on('hostInfo', (hostData) => {
    
    const hostNameElement = document.getElementById('hostName');
    const hostIPElement = document.getElementById('hostIP');
    
    if (hostNameElement && hostData.hostname) {
        hostNameElement.textContent = hostData.hostname;
    }
    
    if (hostIPElement && hostData.ip) {
        hostIPElement.textContent = hostData.ip;
    }
    
});

// Add error handling for socket connection
socket.on('connect_error', (error) => {
    console.error('[DEBUG] Socket connection error:', error);
});

// Add helper function for cleaning up music sessions
function cleanupMusicSessions() {
    const musicSessions = document.getElementById('musicSessions');
    const noMusicState = document.getElementById('noMusicState');
    const activeMusicCount = document.getElementById('activeMusicCount');
    
    if (musicSessions) {
        musicSessions.classList.add('d-none');
        musicSessions.innerHTML = '';
    }
    if (noMusicState) {
        noMusicState.classList.remove('d-none');
    }
    if (activeMusicCount) {
        activeMusicCount.textContent = '0';
    }
}

socket.on('disconnect', (reason) => {
    addLogEntry('ERROR', 'Disconnected from bot server');
    const gatewayStatus = document.getElementById('gatewayStatus');
    if (gatewayStatus) {
        gatewayStatus.textContent = 'Disconnected';
        gatewayStatus.className = 'ms-auto badge bg-danger bg-opacity-25 text-danger';
    }

    // Update WebSocket status
    const socketStatus = document.getElementById('socketStatus');
    if (socketStatus) {
        socketStatus.textContent = 'Disconnected';
        socketStatus.className = 'ms-auto badge bg-danger bg-opacity-25 text-danger';
    }
    
    // Clean up music sessions when disconnected
    cleanupMusicSessions();
});

// Bot status updates
socket.on('status', (status) => {
    const statusElement = document.getElementById('botStatus');
    if (statusElement) {
        if (status === 0) {
            statusElement.textContent = 'Online';
            statusElement.className = 'fw-semibold text-success';
            // Silent - no logging for normal online status
        } else {
            statusElement.textContent = 'Offline';
            statusElement.className = 'fw-semibold text-danger';
            addLogEntry('ERROR', 'Bot went offline');
        }
    }
});

// Guild and user count updates (silent updates - no logging, no animation)
socket.on('guildsize', (count) => {
    const guildCount = document.getElementById('guildCount');
    if (guildCount) {
        guildCount.textContent = count.toLocaleString();
    }
});

socket.on('usercount', (count) => {
    const userCount = document.getElementById('userCount');
    if (userCount) {
        userCount.textContent = count.toLocaleString();
    }
});

// Ping updates (silent updates - no logging)
socket.on('heartbeat', (ping) => {
    const pingElement = document.getElementById('ping');
    if (pingElement) {
        pingElement.textContent = `${ping}ms`;

        // Update ping status color
        if (ping < 100) {
            pingElement.className = 'fw-semibold text-success';
        } else if (ping < 200) {
            pingElement.className = 'fw-semibold text-warning';
        } else {
            pingElement.className = 'fw-semibold text-danger';
        }
    }
});

// Version updates (silent updates - no logging)
socket.on('version', (version) => {
    const verWebgui = document.getElementById('ver_webgui');
    if (verWebgui) {
        verWebgui.textContent = `v${version}`;
    }
    // Also update footer version if element exists
    const footerVersion = document.getElementById('ver_footer');
    if (footerVersion) {
        footerVersion.textContent = `v${version}`;
    }
});

// Handle log messages - only show WARN and ERROR levels
socket.on('log', (message) => {
    // Parse log level from message
    const logMatch = message.match(/\[(\w+)\](.*)/);
    if (logMatch) {
        const level = logMatch[1].toUpperCase();
        const content = logMatch[2].trim();

        // Only log WARN and ERROR messages
        if (level === 'WARN' || level === 'ERROR') {
            addLogEntry(level, content);
        }
    } else {
        // If no level specified, treat as INFO and ignore
        // Only log if it contains error-related keywords
        if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
            addLogEntry('ERROR', message);
        }
    }
});

// System resource updates with enhanced data
socket.on('ResourceUsage', (data) => {
    if (typeof data === 'object' && data.cpu !== undefined) {
        // New enhanced format
        // Update CPU
        document.getElementById('cpuValue').textContent = `${data.cpu}%`;
        document.getElementById('cpuProgress').style.width = `${data.cpu}%`;

        // Update Memory with detailed info
        document.getElementById('memoryValue').textContent = `${data.memory.percent}%`;
        document.getElementById('memoryProgress').style.width = `${data.memory.percent}%`;
        document.getElementById('memoryUsed').textContent = `${data.memory.used} MB`;

        // Use fixed total memory value from server instead of calculating
        if (data.memory.total) {
            document.getElementById('memoryTotal').textContent = `${data.memory.total} MB`;
        } else {
            // Fallback calculation if total is not provided
            const totalMemoryMB = (parseFloat(data.memory.used) / parseFloat(data.memory.percent) * 100).toFixed(0);
            document.getElementById('memoryTotal').textContent = `${totalMemoryMB} MB`;
        }

        // Update Uptime
        document.getElementById('uptime').textContent = data.uptime;

        // Update Process Information
        document.getElementById('processId').textContent = data.process.pid;
        document.getElementById('nodeVersion').textContent = data.process.version;
        document.getElementById('platform').textContent = data.process.platform.charAt(0).toUpperCase() + data.process.platform.slice(1);
        document.getElementById('architecture').textContent = data.process.arch;
        document.getElementById('startTime').textContent = data.process.startTime;

        // Update Memory Management Stats
        if (data.memory.gc) {
            document.getElementById('gcCollections').textContent = data.memory.gc.totalCollections || 0;
            const memoryFreedMB = ((data.memory.gc.totalMemoryFreed || 0) / (1024 * 1024)).toFixed(1);
            document.getElementById('memoryFreed').textContent = memoryFreedMB;
        }
        
        if (data.memory.caches) {
            let totalCacheEntries = 0;
            Object.values(data.memory.caches).forEach(cache => {
                totalCacheEntries += cache.size || 0;
            });
            document.getElementById('cacheEntries').textContent = totalCacheEntries;
        }

        // Estimate thread count (simplified calculation)
        const threadEstimate = Math.max(1, Math.ceil(parseFloat(data.cpu) / 10));
        document.getElementById('threadCount').textContent = threadEstimate;

    } else if (Array.isArray(data)) {
        // Legacy format fallback
        const [cpu, memory, uptime] = data;

        // Update CPU
        document.getElementById('cpuValue').textContent = `${cpu}%`;
        document.getElementById('cpuProgress').style.width = `${cpu}%`;

        // Update Memory
        document.getElementById('memoryValue').textContent = `${memory}%`;
        document.getElementById('memoryProgress').style.width = `${memory}%`;

        // Update Uptime
        document.getElementById('uptime').textContent = uptime;

        // Set basic fallback values
        document.getElementById('processId').textContent = 'N/A';
        document.getElementById('nodeVersion').textContent = 'N/A';
        document.getElementById('platform').textContent = 'Unknown';
        document.getElementById('architecture').textContent = 'N/A';
        document.getElementById('threadCount').textContent = '1';
        document.getElementById('memoryUsed').textContent = '0 MB';
        document.getElementById('memoryTotal').textContent = '0 MB';
        document.getElementById('startTime').textContent = 'Unknown';
    }
});

// Music session updates with automatic cleanup
let lastMusicUpdateTime = Date.now();
socket.on('musicUpdate', (musicData) => {
    lastMusicUpdateTime = Date.now();
    updateMusicSessions(musicData);
});

// Periodic check to clean up stale music sessions (every 30 seconds)
setInterval(() => {
    const timeSinceLastUpdate = Date.now() - lastMusicUpdateTime;
    const musicSessions = document.getElementById('musicSessions');
    const noMusicState = document.getElementById('noMusicState');
    const activeMusicCount = document.getElementById('activeMusicCount');
    
    // If no music update for 2 minutes, assume no active sessions
    if (timeSinceLastUpdate > 120000) { // 2 minutes
        if (musicSessions && !musicSessions.classList.contains('d-none')) {
            musicSessions.classList.add('d-none');
            musicSessions.innerHTML = '';
        }
        if (noMusicState && noMusicState.classList.contains('d-none')) {
            noMusicState.classList.remove('d-none');
        }
        if (activeMusicCount) {
            activeMusicCount.textContent = '0';
        }
    }
}, 30000); // Check every 30 seconds

// Twitch stats updates
socket.on('twitchStats', (twitchData) => {
    updateTwitchStats(twitchData);
});

// Update stat values with animation
function updateStatValue(elementId, newValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent);

    if (currentValue !== newValue) {
        animateCounter(element, newValue);
    }
}

// Animate counter changes
function animateCounter(element, endValue, duration = 300) {
    const startValue = parseInt(element.textContent) || 0;
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
        element.textContent = currentValue.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = endValue.toLocaleString();
        }
    }

    requestAnimationFrame(updateCounter);
}

// Update music sessions display
function updateMusicSessions(musicData) {
    const noMusicState = document.getElementById('noMusicState');
    const musicSessions = document.getElementById('musicSessions');
    const activeMusicCount = document.getElementById('activeMusicCount');

    // Always update the active music count
    if (activeMusicCount) {
        activeMusicCount.textContent = musicData.activePlayersCount || 0;
    }

    // More robust check for active music sessions
    const hasActiveSessions = musicData && 
                             musicData.currentSongs && 
                             Array.isArray(musicData.currentSongs) && 
                             musicData.currentSongs.length > 0 && 
                             (musicData.hasActiveMusic === true || musicData.activePlayersCount > 0);

    if (hasActiveSessions) {
        // Show music sessions
        if (noMusicState) {
            noMusicState.classList.add('d-none');
        }
        if (musicSessions) {
            musicSessions.classList.remove('d-none');
            
            // Clear existing sessions
            musicSessions.innerHTML = '';
            
            // Add each active session
            musicData.currentSongs.forEach((song, index) => {
                const sessionCard = createMusicSessionCard(song, index);
                musicSessions.appendChild(sessionCard);
            });
        }
    } else {
        // Hide music sessions and show no music state
        if (musicSessions) {
            musicSessions.classList.add('d-none');
            // Clear sessions to ensure clean state
            musicSessions.innerHTML = '';
        }
        if (noMusicState) {
            noMusicState.classList.remove('d-none');
        }
    }
}

// Create music session card
function createMusicSessionCard(song, index) {
    const card = document.createElement('div');
    card.className = 'card bg-body-secondary bg-opacity-50 border-0 glass-effect flex-grow-1 d-flex flex-column';

    const progressPercent = song.progressPercent || 0;
    const duration = formatDuration(song.duration);
    const elapsed = formatDuration(song.elapsedSeconds || 0);



    card.innerHTML = `
        <div class="card-body p-4 flex-grow-1 d-flex flex-column">
            <!-- Header Row -->
            <div class="row align-items-center mb-3">
                <div class="col">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary bg-opacity-25 text-primary rounded-circle p-2 me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                            <i class="bi bi-music-note fs-6"></i>
                        </div>
                        <div>
                            <h6 class="mb-0 fw-semibold">Now Playing</h6>
                            <small class="text-muted">Session ${index + 1}</small>
                        </div>
                    </div>
                </div>
                <div class="col-auto">
                    <div class="d-flex gap-2">
                        <a href="${escapeHtml(song.url || '')}" target="_blank" class="btn btn-outline-primary btn-sm rounded-pill px-3">
                            <i class="bi bi-youtube me-1"></i> YouTube
                        </a>
                    </div>
                </div>
            </div>

            <!-- Main Content Row -->
            <div class="row flex-grow-1">
                <!-- Album Art -->
                <div class="col-12 col-md-3 col-lg-2 mb-3 mb-md-0">
                    <div class="position-relative">
                        <img src="https://i.ytimg.com/vi/${escapeHtml(song.image || '')}/mqdefault.jpg" 
                             alt="Album Art" class="w-100 rounded-3 shadow"
                             style="aspect-ratio: 1; object-fit: cover;">
                        <div class="position-absolute top-50 start-50 translate-middle">
                            <div class="bg-dark bg-opacity-75 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                <i class="bi bi-play-fill text-white fs-5"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Track Info -->
                <div class="col-12 col-md-9 col-lg-10 d-flex flex-column">
                    <!-- Title and Artist - Expanded -->
                    <div class="mb-3 mb-lg-4">
                        <h5 class="mb-1 fw-bold text-truncate">${escapeHtml(song.title || 'Unknown Title')}</h5>
                        <p class="mb-0 text-muted fs-6">${escapeHtml(song.Channel || song.channel || song.artist || song.uploader || song.author || 'Unknown Artist')}</p>
                    </div>

                    <!-- Progress Section - Expanded -->
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="fw-medium text-muted small">Progress</span>
                            <span class="fw-semibold small">${elapsed} / ${duration}</span>
                        </div>
                        <div class="progress mb-3" style="height: 12px;">
                            <div class="progress-bar bg-primary progress-bar-striped progress-bar-animated" 
                                 style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="d-flex justify-content-between text-muted small mb-3">
                            <span class="d-none d-sm-block">Started ${elapsed} ago</span>
                            <span class="d-sm-none">Started ${elapsed}</span>
                            <span>${Math.round(progressPercent)}% complete</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Server Info and Stats - 3 Columns -->
            <div class="row g-3 mt-3 mb-3">
                <!-- Server Info -->
                <div class="col-12 col-sm-4 d-flex">
                    <div class="bg-body bg-opacity-50 rounded-3 p-4 w-100 d-flex flex-column justify-content-center" style="min-height: 100px;">
                        <div class="d-flex align-items-center justify-content-center mb-2">
                            <i class="bi bi-server text-primary me-2"></i>
                            <span class="fw-medium small">Server</span>
                        </div>
                        <div class="fw-semibold small text-truncate text-center" title="${escapeHtml(song.serverName || 'Unknown Server')}">${escapeHtml(song.serverName || 'Unknown Server')}</div>
                    </div>
                </div>

                <!-- Queue Info -->
                <div class="col-6 col-sm-4 d-flex">
                    <div class="bg-body bg-opacity-50 rounded-3 p-4 w-100 d-flex flex-column justify-content-center text-center" style="min-height: 100px;">
                        <div class="text-primary fs-4 fw-bold">${song.queueLength || 0}</div>
                        <div class="small text-muted">Queue</div>
                    </div>
                </div>

                <!-- Listeners -->
                <div class="col-6 col-sm-4 d-flex">
                    <div class="bg-body bg-opacity-50 rounded-3 p-4 w-100 d-flex flex-column justify-content-center text-center" style="min-height: 100px;">
                        <div class="text-primary fs-4 fw-bold">${song.listeners || 1}</div>
                        <div class="small text-muted fw-medium">Listeners</div>
                    </div>
                </div>
            </div>

            <!-- Footer Row -->
            <div class="row mt-auto pt-3 border-top border-opacity-25">
                <div class="col">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex gap-3">
                            <span class="badge bg-success bg-opacity-25 text-success">
                                <i class="bi bi-person me-1"></i>
                                Requested by ${escapeHtml(song.requestedBy || 'Unknown')}
                            </span>
                            <span class="badge bg-success bg-opacity-25 text-success">
                                <i class="bi bi-broadcast me-1"></i>
                                Live Session
                            </span>
                        </div>
                        <div class="text-muted small">
                            <i class="bi bi-clock me-1"></i>
                            Active for ${elapsed}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return card;
}

// Format duration
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Activity logging with duplicate prevention
let lastLogMessage = '';
let lastLogTime = 0;
const LOG_THROTTLE_MS = 5000; // 5 seconds minimum between duplicate messages

function addLogEntry(level, message) {
    const logContainer = document.getElementById('logContainer');
    const timestamp = new Date().toLocaleTimeString();
    const now = Date.now();

    // Prevent duplicate messages within throttle period
    if (message === lastLogMessage && (now - lastLogTime) < LOG_THROTTLE_MS) {
        return;
    }

    lastLogMessage = message;
    lastLogTime = now;

    const logItem = document.createElement('div');
    logItem.className = 'd-flex align-items-center py-2 px-3 bg-body bg-opacity-50 rounded-2 mb-2';

    const levelColor = {
        'info': 'info',
        'warn': 'warning',
        'warning': 'warning',
        'error': 'danger',
        'success': 'success'
    }[level.toLowerCase()] || 'secondary';



    logItem.innerHTML = `
        <span class="text-muted small me-3">${timestamp}</span>
        <span class="badge bg-${levelColor} bg-opacity-25 text-${levelColor} me-3 small">[${level}]</span>
        <span class="text-body">${escapeHtml(message)}</span>
    `;

    logContainer.appendChild(logItem);

    // Keep only last 30 log entries (reduced from 50)
    const logItems = logContainer.querySelectorAll('.d-flex.align-items-center');
    if (logItems.length > 30) {
        logItems[0].remove();
    }

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Clear logs functionality
const clearLogsBtn = document.getElementById('clearLogs');
if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
        const logContainer = document.getElementById('logContainer');
        if (logContainer) {
            logContainer.innerHTML = '';
            addLogEntry('INFO', 'Log cleared by user');
        }
    });
}

// Refresh functionality
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
        this.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        this.disabled = true;

        // Add loading animation
        this.classList.add('loading-shimmer');

        setTimeout(() => {
            location.reload();
        }, 1000);
    });
}

// Initialize dashboard on load
document.addEventListener('DOMContentLoaded', () => {
    detectHostInfo();
    initializeDashboard();

    // Silent initialization - no logging

    // Get command counts from actual files
    getCommandCounts();
    
    // Request initial music session update
    setTimeout(() => {
        // Request current music status from server
        if (socket.connected) {
            socket.emit('requestMusicUpdate');
        }
    }, 2000);
});

// Get real command counts from the bot
function getCommandCounts() {
    // This will be populated from the bot's actual command structure
    // For now, using reasonable estimates based on the file structure
    const commandCounts = {
        music: 2,    // MusicPlayer.js, PlayStatus.js
        utility: 5,  // info.js, invite.js, ping.js, serverinfo.js, userinfo.js
        moderation: 0,  // No moderation commands visible in structure
        fun: 0      // No fun commands visible in structure
    };

    // Update command counts with null checks
    const musicCommands = document.getElementById('musicCommands');
    if (musicCommands) {
        musicCommands.textContent = commandCounts.music;
    }

    const utilityCommands = document.getElementById('utilityCommands');
    if (utilityCommands) {
        utilityCommands.textContent = commandCounts.utility;
    }

    const moderationCommands = document.getElementById('moderationCommands');
    if (moderationCommands) {
        moderationCommands.textContent = commandCounts.moderation;
    }

    const funCommands = document.getElementById('funCommands');
    if (funCommands) {
        funCommands.textContent = commandCounts.fun;
    }
}

// Handle window visibility change to optimize performance (silent)
document.addEventListener('visibilitychange', () => {
    // Silent visibility changes - no logging to reduce spam
    // Performance optimizations can happen here without cluttering logs
});

// Console branding
console.log(`%c
   _____ _     _             _           _    _                  _         
  / ____| |   (_)           | |         | |  | |                | |        
 | |    | |__  _ _   _  ___ | | _____   | |__| | __ _ _ __ _   _| | ____ _ 
 | |    | '_ \\| | | | |/ _ \\| |/ / _ \\  |  __  |/ _\` | '__| | | | |/ / _\` |
 | |____| | | | | |_| | (_) |   < (_) | | |  | | (_| | |  | |_| |   < (_| |
  \\_____|_| |_|_|\\__, |\\___/|_|\\_\\___/  |_|  |_|\\__,_|_|   \\__,_|_|\\_\\__,_|
                  __/ |                                                    
                 |___/                                                     

%cModern Dashboard v2.0
%cBuilt with Microsoft Fluent Design 2 inspiration
%cGitHub: https://github.com/Harleythetech/Chiyoko-Haruka
`,
    'color: #667eea; font-family: monospace;',
    'color: #764ba2; font-weight: bold;',
    'color: #666; font-style: italic;',
    'color: #667eea;'
);

// Twitch Management Functions
function updateTwitchStats(twitchData) {
    // Update status indicators
    const twitchStatus = document.getElementById('twitchStatus');
    if (twitchStatus) {
        if (twitchData.isMonitoring) {
            twitchStatus.textContent = 'Active';
            twitchStatus.className = 'fs-4 fw-semibold text-success';
        } else {
            twitchStatus.textContent = 'Inactive';
            twitchStatus.className = 'fs-4 fw-semibold text-danger';
        }
    }

    // Update counts
    const totalStreamers = document.getElementById('totalStreamers');
    if (totalStreamers) {
        totalStreamers.textContent = twitchData.totalStreamers || 0;
    }

    const liveStreamers = document.getElementById('liveStreamers');
    if (liveStreamers) {
        liveStreamers.textContent = twitchData.liveStreamers || 0;
    }

    const twitchGuilds = document.getElementById('twitchGuilds');
    if (twitchGuilds) {
        twitchGuilds.textContent = twitchData.totalGuilds || 0;
    }

    // Update summary section
    updateTwitchSummary(twitchData);
}

function updateTwitchSummary(twitchData) {
    const noTwitchState = document.getElementById('noTwitchState');
    const twitchSummary = document.getElementById('twitchSummary');

    if (twitchData.totalStreamers > 0) {
        if (noTwitchState) noTwitchState.classList.add('d-none');
        if (twitchSummary) twitchSummary.classList.remove('d-none');

        // Update summary numbers
        const summaryServers = document.getElementById('summaryServers');
        if (summaryServers) summaryServers.textContent = twitchData.totalGuilds || 0;

        const summaryStreamers = document.getElementById('summaryStreamers');
        if (summaryStreamers) summaryStreamers.textContent = twitchData.totalStreamers || 0;

        const summaryLive = document.getElementById('summaryLive');
        if (summaryLive) summaryLive.textContent = twitchData.liveStreamers || 0;
        
        // Update streamers list in dashboard
        updateDashboardStreamersList(twitchData);
    } else {
        if (noTwitchState) noTwitchState.classList.remove('d-none');
        if (twitchSummary) twitchSummary.classList.add('d-none');
    }
}

// Update the streamers list in the dashboard card
function updateDashboardStreamersList(twitchData) {
    const streamersList = document.getElementById('streamersList');
    if (!streamersList) return;
    
    // Clear existing content
    streamersList.innerHTML = '';
    
    if (!twitchData.streamers || twitchData.streamers.length === 0) {
        streamersList.innerHTML = `
            <div class="text-center py-3 text-muted">
                <i class="bi bi-person-video2 opacity-50"></i>
                <div class="small mt-1">No streamers configured</div>
            </div>
        `;
        return;
    }
    
    // Add each streamer
    twitchData.streamers.forEach(streamer => {
        const streamerItem = document.createElement('div');
        streamerItem.className = 'd-flex align-items-center justify-content-between py-2 px-3 bg-body bg-opacity-25 rounded-2 mb-2';
        
        const statusIcon = streamer.isLive ? 
            '<i class="bi bi-record-circle-fill text-danger me-2"></i>' :
            '<i class="bi bi-circle text-muted me-2"></i>';
            
        const statusBadge = streamer.isLive ? 
            '<span class="badge bg-danger bg-opacity-25 text-danger">LIVE</span>' :
            '<span class="badge bg-secondary bg-opacity-25 text-secondary">Offline</span>';
        

        
        // Show stream title first, then username | game name
        const primaryText = escapeHtml(streamer.lastStreamTitle || 'No recent activity');
        const secondaryText = streamer.lastGameName ? 
            `@${escapeHtml(streamer.username)} | ${escapeHtml(streamer.lastGameName)}` : 
            `@${escapeHtml(streamer.username)}`;
        
        streamerItem.innerHTML = `
            <div class="d-flex align-items-center flex-grow-1">
                ${statusIcon}
                <div class="flex-grow-1">
                    <div class="fw-medium small">${primaryText}</div>
                    <div class="small text-muted">${secondaryText}</div>
                </div>
            </div>
            <div class="ms-2">
                ${statusBadge}
            </div>
        `;
        
        streamersList.appendChild(streamerItem);
    });
}

// Twitch Modal Management
let currentTwitchGuildId = null;

// Initialize Twitch modal when opened
function initializeTwitchModal() {
    const modal = document.getElementById('twitchModal');
    const serverSelect = document.getElementById('serverSelect');
    const loadingState = document.getElementById('loadingState');
    const serverConfig = document.getElementById('serverConfig');

    // Reset state
    currentTwitchGuildId = null;
    if (serverConfig) serverConfig.classList.add('d-none');
    if (loadingState) loadingState.classList.remove('d-none');

    // Load servers
    fetch('/api/twitch/guilds')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }

            // Populate server select
            if (serverSelect) {
                serverSelect.innerHTML = '<option value="">Select a server...</option>';
                data.guilds.forEach(guild => {
                    const option = document.createElement('option');
                    option.value = guild.id;
                    option.textContent = `${guild.name} (${guild.memberCount} members)${guild.hasConfig ? ' ✓' : ''}`;
                    serverSelect.appendChild(option);
                });
            }

            if (loadingState) loadingState.classList.add('d-none');
        })
        .catch(error => {
            console.error('Error loading servers:', error);
            if (loadingState) {
                loadingState.innerHTML = `
                    <div class="text-center py-4">
                        <i class="bi bi-exclamation-triangle text-warning fs-1"></i>
                        <div class="mt-2 text-danger">Error loading servers</div>
                        <div class="small text-muted">${error.message}</div>
                    </div>
                `;
            }
        });
}

// Load server configuration
function loadServerConfig(guildId) {
    currentTwitchGuildId = guildId;
    const serverConfig = document.getElementById('serverConfig');

    if (!guildId) {
        if (serverConfig) serverConfig.classList.add('d-none');
        return;
    }

    fetch(`/api/twitch/guild/${guildId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }

            // Populate channels
            const channelSelect = document.getElementById('channelSelect');
            if (channelSelect) {
                channelSelect.innerHTML = '<option value="">Select a channel...</option>';
                data.channels.forEach(channel => {
                    const option = document.createElement('option');
                    option.value = channel.id;
                    option.textContent = `#${channel.name}`;
                    if (channel.id === data.notificationChannelId) {
                        option.selected = true;
                    }
                    channelSelect.appendChild(option);
                });
            }

            // Display streamers
            displayStreamers(data.streamers);

            if (serverConfig) serverConfig.classList.remove('d-none');
        })
        .catch(error => {
            console.error('Error loading server config:', error);
            alert(`Error loading server configuration: ${error.message}`);
        });
}

// Display streamers list
function displayStreamers(streamers) {
    const modalStreamersList = document.getElementById('modalStreamersList');
    const noStreamersMessage = document.getElementById('noStreamersMessage');

    if (!streamers || streamers.length === 0) {
        if (noStreamersMessage) noStreamersMessage.classList.remove('d-none');
        if (modalStreamersList) {
            modalStreamersList.querySelectorAll('.streamer-item').forEach(item => item.remove());
        }
        return;
    }

    if (noStreamersMessage) noStreamersMessage.classList.add('d-none');

    // Clear existing streamers
    if (modalStreamersList) {
        modalStreamersList.querySelectorAll('.streamer-item').forEach(item => item.remove());

        // Add streamers
        streamers.forEach(streamer => {
            const streamerItem = document.createElement('div');
            streamerItem.className = 'streamer-item d-flex align-items-center justify-content-between py-2 px-3 bg-body bg-opacity-50 rounded-2 mb-2';

            const statusIcon = streamer.isLive ? 
                '<i class="bi bi-record-circle-fill text-danger me-2"></i>' :
                '<i class="bi bi-circle text-secondary me-2"></i>';

            const lastChecked = streamer.lastChecked ? 
                new Date(streamer.lastChecked).toLocaleString() : 'Never';



            // Use stream title if available, otherwise fallback to username
            const displayTitle = escapeHtml(streamer.lastStreamTitle || `@${streamer.username}`);

            streamerItem.innerHTML = `
                <div class="d-flex align-items-center">
                    ${statusIcon}
                    <div>
                        <div class="fw-semibold">
                            <a href="https://twitch.tv/${escapeHtml(streamer.username)}" target="_blank" class="text-decoration-none">
                                ${displayTitle}
                            </a>
                            ${streamer.isLive ? '<span class="badge bg-danger bg-opacity-25 text-danger ms-2">LIVE</span>' : ''}
                        </div>
                        <div class="small text-muted">
                            @${escapeHtml(streamer.username)}${streamer.lastGameName ? ` | ${escapeHtml(streamer.lastGameName)}` : ''}
                            <br>Last checked: ${lastChecked}
                        </div>
                    </div>
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick="removeStreamer('${escapeHtml(streamer.username)}')">
                    <i class="bi bi-trash3"></i>
                </button>
            `;

            modalStreamersList.appendChild(streamerItem);
        });
    }
}

// Add streamer
function addStreamer() {
    const streamerInput = document.getElementById('streamerInput');
    const channelSelect = document.getElementById('channelSelect');

    if (!currentTwitchGuildId) {
        alert('Please select a server first');
        return;
    }

    const username = streamerInput?.value.trim();
    const channelId = channelSelect?.value;

    if (!username) {
        alert('Please enter a Twitch username');
        return;
    }

    if (!channelId) {
        alert('Please select a notification channel');
        return;
    }

    // Disable button during request
    const addBtn = document.getElementById('addStreamerBtn');
    if (addBtn) {
        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Adding...';
    }

    fetch(`/api/twitch/guild/${currentTwitchGuildId}/add`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, channelId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (streamerInput) streamerInput.value = '';
            loadServerConfig(currentTwitchGuildId); // Reload to show updated list
            addLogEntry('SUCCESS', `Added Twitch streamer: ${username}`);
        } else {
            alert(`Error: ${data.message}`);
        }
    })
    .catch(error => {
        console.error('Error adding streamer:', error);
        alert('Error adding streamer');
    })
    .finally(() => {
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="bi bi-plus-lg"></i> Add';
        }
    });
}

// Remove streamer
function removeStreamer(username) {
    if (!currentTwitchGuildId) return;

    if (!confirm(`Remove ${username} from monitoring?`)) return;

    fetch(`/api/twitch/guild/${currentTwitchGuildId}/remove`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadServerConfig(currentTwitchGuildId); // Reload to show updated list
            addLogEntry('SUCCESS', `Removed Twitch streamer: ${username}`);
        } else {
            alert(`Error: ${data.message}`);
        }
    })
    .catch(error => {
        console.error('Error removing streamer:', error);
        alert('Error removing streamer');
    });
}

// Update notification channel
function updateNotificationChannel() {
    const channelSelect = document.getElementById('channelSelect');
    
    if (!currentTwitchGuildId || !channelSelect) return;

    const channelId = channelSelect.value;
    if (!channelId) {
        alert('Please select a channel');
        return;
    }

    const updateBtn = document.getElementById('updateChannelBtn');
    if (updateBtn) {
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    }

    fetch(`/api/twitch/guild/${currentTwitchGuildId}/channel`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channelId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addLogEntry('SUCCESS', 'Updated notification channel');
        } else {
            alert(`Error: ${data.message}`);
        }
    })
    .catch(error => {
        console.error('Error updating channel:', error);
        alert('Error updating channel');
    })
    .finally(() => {
        if (updateBtn) {
            updateBtn.disabled = false;
            updateBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
        }
    });
}

// Event listeners for Twitch modal
document.addEventListener('DOMContentLoaded', () => {
    const twitchModal = document.getElementById('twitchModal');
    if (twitchModal) {
        twitchModal.addEventListener('show.bs.modal', initializeTwitchModal);
    }

    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.addEventListener('change', (e) => {
            loadServerConfig(e.target.value);
        });
    }

    const addStreamerBtn = document.getElementById('addStreamerBtn');
    if (addStreamerBtn) {
        addStreamerBtn.addEventListener('click', addStreamer);
    }

    const updateChannelBtn = document.getElementById('updateChannelBtn');
    if (updateChannelBtn) {
        updateChannelBtn.addEventListener('click', updateNotificationChannel);
    }

    const streamerInput = document.getElementById('streamerInput');
    if (streamerInput) {
        streamerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addStreamer();
            }
        });
    }
});

// ========================================
// Link Scanner Management Functions
// ========================================

let linkScannerData = null;

function updateLinkScannerStats(data) {
    if (!data) return;
    
    // Update paginated stats tab Link Scanner status
    const linkScannerStatus = document.getElementById('linkScannerStatus');
    const blockedDomains = document.getElementById('blockedDomains');
    const activeSources = document.getElementById('activeSources');
    const totalSources = document.getElementById('totalSources');
    
    if (linkScannerStatus) {
        const isActive = data.status.initialized;
        linkScannerStatus.textContent = isActive ? 'Active' : 'Offline';
        linkScannerStatus.className = isActive ? 'fs-4 fw-semibold text-success' : 'fs-4 fw-semibold text-danger';
    }
    
    if (blockedDomains) {
        blockedDomains.textContent = data.status.totalBlockedDomains.toLocaleString();
    }
    
    if (activeSources) {
        activeSources.textContent = data.status.enabledSources;
    }
    
    if (totalSources) {
        totalSources.textContent = data.status.totalSources;
    }
    
    // Update summary section in dashboard cards
    updateLinkScannerSummary(data);
}

function updateLinkScannerSummary(data) {
    if (!data) return;
    
    const noLinkScannerState = document.getElementById('noLinkScannerState');
    const linkScannerSummary = document.getElementById('linkScannerSummary');
    
    if (data.status.totalSources === 0) {
        if (noLinkScannerState) noLinkScannerState.classList.remove('d-none');
        if (linkScannerSummary) linkScannerSummary.classList.add('d-none');
    } else {
        if (noLinkScannerState) noLinkScannerState.classList.add('d-none');
        if (linkScannerSummary) linkScannerSummary.classList.remove('d-none');
        
        const summarySources = document.getElementById('summarySources');
        const summaryBlocked = document.getElementById('summaryBlocked');
        const summaryStatus = document.getElementById('summaryStatus');
        
        if (summarySources) summarySources.textContent = data.status.enabledSources;
        if (summaryBlocked) summaryBlocked.textContent = data.status.totalBlockedDomains;
        if (summaryStatus) summaryStatus.textContent = data.status.initialized ? 'ON' : 'OFF';
        
        // Update sources list in dashboard
        updateDashboardSourcesList(data);
    }
}

// Update the sources list in the dashboard card
function updateDashboardSourcesList(data) {
    const linkSourcesList = document.getElementById('linkSourcesList');
    if (!linkSourcesList) return;
    
    // Clear existing content
    linkSourcesList.innerHTML = '';
    
    if (!data.sources || data.sources.length === 0) {
        linkSourcesList.innerHTML = `
            <div class="text-center py-3 text-muted">
                <i class="bi bi-shield-x opacity-50"></i>
                <div class="small mt-1">No sources configured</div>
            </div>
        `;
        return;
    }
    
    // Add each source
    data.sources.forEach(source => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'd-flex align-items-center justify-content-between py-2 px-3 bg-body bg-opacity-25 rounded-2 mb-2';
        
        const statusIcon = source.enabled ? 
            '<i class="bi bi-shield-check text-success me-2"></i>' :
            '<i class="bi bi-shield-x text-muted me-2"></i>';
            
        const statusBadge = source.enabled ? 
            '<span class="badge bg-success bg-opacity-25 text-success">Active</span>' :
            '<span class="badge bg-secondary bg-opacity-25 text-secondary">Disabled</span>';
            
        const typeColor = {
            'domain': 'primary',
            'hosts': 'info', 
            'adblock': 'warning'
        }[source.type] || 'secondary';
        
        sourceItem.innerHTML = `
            <div class="d-flex align-items-center flex-grow-1">
                ${statusIcon}
                <div class="flex-grow-1">
                    <div class="fw-medium small">${escapeHtml(source.name)}</div>
                    <div class="small text-muted">
                        <span class="badge bg-${typeColor} bg-opacity-25 text-${typeColor} me-1">${source.type}</span>
                        ${source.lastUpdated ? new Date(source.lastUpdated).toLocaleDateString() : 'Never updated'}
                    </div>
                </div>
            </div>
            <div class="ms-2">
                ${statusBadge}
            </div>
        `;
        
        linkSourcesList.appendChild(sourceItem);
    });
}

function initializeLinkScannerModal() {
    const linkScannerModal = document.getElementById('linkScannerModal');
    if (!linkScannerModal) return;
    
    linkScannerModal.addEventListener('shown.bs.modal', () => {
        loadLinkScannerSources();
    });
}

async function loadLinkScannerSources() {
    try {
        const response = await fetch('/api/linkscanner/sources');
        const data = await response.json();
        
        if (data.success) {
            linkScannerData = data;
            updateModalStats(data.status);
            renderSourcesList(data.sources);
        } else {
            showAlert('Error loading sources: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('Error loading Link Scanner sources:', error);
        showAlert('Failed to load sources', 'danger');
    }
}

function updateModalStats(status) {
    const modalTotalSources = document.getElementById('modalTotalSources');
    const modalActiveSources = document.getElementById('modalActiveSources');
    const modalBlockedDomains = document.getElementById('modalBlockedDomains');
    const modalLastUpdate = document.getElementById('modalLastUpdate');
    const sourcesCount = document.getElementById('sourcesCount');
    
    if (modalTotalSources) modalTotalSources.textContent = status.totalSources;
    if (modalActiveSources) modalActiveSources.textContent = status.enabledSources;
    if (modalBlockedDomains) modalBlockedDomains.textContent = status.totalBlockedDomains.toLocaleString();
    if (sourcesCount) sourcesCount.textContent = `${status.totalSources} source${status.totalSources !== 1 ? 's' : ''}`;
    
    if (modalLastUpdate) {
        const lastUpdate = new Date(status.lastBlocklistUpdate);
        modalLastUpdate.textContent = isNaN(lastUpdate.getTime()) ? 'Never' : lastUpdate.toLocaleTimeString();
    }
}

function renderSourcesList(sources) {
    const sourcesList = document.getElementById('sourcesList');
    const sourcesLoading = document.getElementById('sourcesLoading');
    const noSourcesMessage = document.getElementById('noSourcesMessage');
    
    if (sourcesLoading) sourcesLoading.classList.add('d-none');
    
    if (!sources || sources.length === 0) {
        if (noSourcesMessage) noSourcesMessage.classList.remove('d-none');
        return;
    }
    
    if (noSourcesMessage) noSourcesMessage.classList.add('d-none');
    
    // Clear existing sources (except loading/no sources messages)
    const existingSources = sourcesList.querySelectorAll('.source-item');
    existingSources.forEach(item => item.remove());
    
    sources.forEach(source => {
        const sourceElement = createSourceElement(source);
        sourcesList.appendChild(sourceElement);
    });
}

function createSourceElement(source) {
    const div = document.createElement('div');
    div.className = 'source-item border-bottom border-opacity-25 pb-3 mb-3';
    
    const typeColor = getTypeColor(source.type);
    const statusBadge = source.enabled ? 
        '<span class="badge bg-success bg-opacity-25 text-success">Enabled</span>' : 
        '<span class="badge bg-secondary bg-opacity-25 text-secondary">Disabled</span>';
    
    const lastUpdated = source.lastUpdated ? 
        new Date(source.lastUpdated).toLocaleString() : 'Never';
    
    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-2">
                    <h6 class="mb-0 me-2">${escapeHtml(source.name)}</h6>
                    <span class="badge ${typeColor} me-2">${source.type}</span>
                    ${statusBadge}
                </div>
                <div class="text-muted small mb-2">${escapeHtml(source.description || 'No description')}</div>
                <div class="text-muted small">
                    <strong>URL:</strong> <a href="${escapeHtml(source.url)}" target="_blank" class="text-decoration-none">${escapeHtml(source.url)}</a>
                </div>
                <div class="text-muted small">
                    <strong>Last Updated:</strong> ${lastUpdated}
                </div>
            </div>
            <div class="ms-3">
                <div class="btn-group-vertical btn-group-sm">
                    <button class="btn btn-outline-${source.enabled ? 'warning' : 'success'}" onclick="toggleSource('${source.id}', ${!source.enabled})">
                        <i class="bi bi-${source.enabled ? 'pause' : 'play'}-fill"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteSource('${source.id}', '${escapeHtml(source.name)}')">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return div;
}

function getTypeColor(type) {
    const colors = {
        'domain': 'bg-primary bg-opacity-25 text-primary',
        'hosts': 'bg-info bg-opacity-25 text-info',
        'adblock': 'bg-warning bg-opacity-25 text-warning'
    };
    return colors[type] || 'bg-secondary bg-opacity-25 text-secondary';
}

async function addNewSource(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const sourceData = {
        name: formData.get('name'),
        url: formData.get('url'),
        type: formData.get('type'),
        description: formData.get('description'),
        enabled: formData.get('enabled') === 'on'
    };
    
    try {
        const response = await fetch('/api/linkscanner/sources', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sourceData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Source added successfully', 'success');
            form.reset();
            document.getElementById('sourceEnabled').checked = true; // Reset to default
            loadLinkScannerSources(); // Reload sources
        } else {
            showAlert('Error adding source: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error adding source:', error);
        showAlert('Failed to add source', 'danger');
    }
}

async function toggleSource(sourceId, enabled) {
    try {
        const response = await fetch(`/api/linkscanner/sources/${sourceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`Source ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
            loadLinkScannerSources(); // Reload sources
        } else {
            showAlert('Error updating source: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error updating source:', error);
        showAlert('Failed to update source', 'danger');
    }
}

async function deleteSource(sourceId, sourceName) {
    if (!confirm(`Are you sure you want to delete "${sourceName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/linkscanner/sources/${sourceId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Source deleted successfully', 'success');
            loadLinkScannerSources(); // Reload sources
        } else {
            showAlert('Error deleting source: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error deleting source:', error);
        showAlert('Failed to delete source', 'danger');
    }
}

async function refreshAllSources() {
    try {
        const response = await fetch('/api/linkscanner/refresh', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Refresh initiated successfully', 'success');
            setTimeout(() => {
                loadLinkScannerSources(); // Reload after a delay
            }, 2000);
        } else {
            showAlert('Error refreshing sources: ' + result.error, 'danger');
        }
    } catch (error) {
        console.error('Error refreshing sources:', error);
        showAlert('Failed to refresh sources', 'danger');
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialize Link Scanner when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeLinkScannerModal();
    
    // Add event listeners for Link Scanner
    const addSourceForm = document.getElementById('addSourceForm');
    if (addSourceForm) {
        addSourceForm.addEventListener('submit', addNewSource);
    }
    
    const refreshAllBtn = document.getElementById('refreshAllBtn');
    if (refreshAllBtn) {
        refreshAllBtn.addEventListener('click', refreshAllSources);
    }
    
    const refreshSourcesBtn = document.getElementById('refreshSourcesBtn');
    if (refreshSourcesBtn) {
        refreshSourcesBtn.addEventListener('click', refreshAllSources);
    }
    
    // Load initial data
    loadLinkScannerSources();
});

// Add Link Scanner data to socket events
socket.on('stats', (data) => {
    // Handle general stats updates if needed
    // Currently no general stats handler needed
});

// Update general stats function (placeholder for future use)
function updateStats(data) {
    if (!data) return;
    // Handle general statistics updates here if needed
    console.log('General stats update:', data);
}

// Dedicated Link Scanner status socket handler
socket.on('linkScannerStats', (data) => {
    updateLinkScannerStats(data);
});

// Request initial status updates when connected
socket.on('connect', () => {
    // Silent connection - no logging to reduce spam
    const gatewayStatus = document.getElementById('gatewayStatus');
    if (gatewayStatus) {
        gatewayStatus.textContent = 'Connected';
        gatewayStatus.className = 'ms-auto badge bg-success bg-opacity-25 text-success';
    }

    // Update WebSocket status
    const socketStatus = document.getElementById('socketStatus');
    if (socketStatus) {
        socketStatus.textContent = 'Connected';
        socketStatus.className = 'ms-auto badge bg-info bg-opacity-25 text-info';
    }
    
    // Reset music sessions on reconnect and request fresh data
    setTimeout(() => {
        // Clean up any stale sessions first
        cleanupMusicSessions();
        
        // Request fresh music status
        socket.emit('requestMusicUpdate');
        
        // Request initial Link Scanner status
        fetch('/api/linkscanner/status')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateLinkScannerStats(data);
                }
            })
            .catch(error => console.error('Error fetching Link Scanner status:', error));
    }, 1000);
});

// Force garbage collection function
async function forceGarbageCollection() {
    try {
        const response = await fetch('/api/memory/gc', { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            alert('Garbage collection completed successfully!');
        } else {
            alert('Failed to run garbage collection: ' + result.error);
        }
    } catch (error) {
        console.error('Error running garbage collection:', error);
        alert('Error running garbage collection: ' + error.message);
    }
}
