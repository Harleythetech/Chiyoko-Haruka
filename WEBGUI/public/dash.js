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
        'startTime': 'Loading...'
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
    
});

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

        // Calculate and display total memory estimate (used memory / percentage * 100)
        const totalMemoryMB = (parseFloat(data.memory.used) / parseFloat(data.memory.percent) * 100).toFixed(0);
        document.getElementById('memoryTotal').textContent = `${totalMemoryMB} MB`;

        // Update Uptime
        document.getElementById('uptime').textContent = data.uptime;

        // Update Process Information
        document.getElementById('processId').textContent = data.process.pid;
        document.getElementById('nodeVersion').textContent = data.process.version;
        document.getElementById('platform').textContent = data.process.platform.charAt(0).toUpperCase() + data.process.platform.slice(1);
        document.getElementById('architecture').textContent = data.process.arch;
        document.getElementById('startTime').textContent = data.process.startTime;

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

// Music session updates
socket.on('musicUpdate', (musicData) => {
    updateMusicSessions(musicData);
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

    if (activeMusicCount) {
        activeMusicCount.textContent = musicData.activePlayersCount || 0;
    }

    if (musicData.hasActiveMusic && musicData.currentSongs && musicData.currentSongs.length > 0) {
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

        // Silent updates - no logging for music session updates
    } else {
        if (noMusicState) {
            noMusicState.classList.remove('d-none');
        }
        if (musicSessions) {
            musicSessions.classList.add('d-none');
        }

        // Silent - no logging when music stops
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
                        <a href="${song.url}" target="_blank" class="btn btn-outline-primary btn-sm rounded-pill px-3">
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
                        <img src="https://i.ytimg.com/vi/${song.image}/mqdefault.jpg" 
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
                        <h5 class="mb-1 fw-bold text-truncate">${song.title || 'Unknown Title'}</h5>
                        <p class="mb-0 text-muted fs-6">${song.Channel || song.channel || song.artist || song.uploader || song.author || 'Unknown Artist'}</p>
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
                        <div class="fw-semibold small text-truncate text-center" title="${song.serverName || 'Unknown Server'}">${song.serverName || 'Unknown Server'}</div>
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
                                Requested by ${song.requestedBy || 'Unknown'}
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
        <span class="text-body">${message}</span>
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


