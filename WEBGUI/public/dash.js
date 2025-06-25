const socket = io();

// Chart configuration
const ctx = document.getElementById('ping_chart').getContext('2d');

const pingData = {
    labels: [],
    datasets: [{
        label: 'Ping (ms)',
        data: [],
        borderColor: '#4facfe',
        backgroundColor: 'rgba(79, 172, 254, 0.1)',
        tension: 0.4,
        fill: true,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#4facfe',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
    }]
};

const pingChart = new Chart(ctx, {
    type: 'line',
    data: pingData,
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#4facfe',
                borderWidth: 1,
            }
        },
        scales: {
            x: {
                display: false,
                grid: {
                    display: false,
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                    color: '#9ca3af',
                    font: {
                        size: 11,
                    }
                },
                title: {
                    display: true,
                    text: 'Latency (ms)',
                    color: '#9ca3af',
                    font: {
                        size: 12,
                    }
                }
            },
        },
        interaction: {
            intersect: false,
            mode: 'index',
        },
    },
});

// Update ping chart and current ping display
socket.on('heartbeat', (data) => {
    const now = new Date().toLocaleTimeString();

    // Keep only last 20 data points
    if (pingData.labels.length > 20) {
        pingData.labels.shift();
        pingData.datasets[0].data.shift();
    }
    
    pingData.labels.push(now);
    pingData.datasets[0].data.push(data);
    pingChart.update('none');
    
    // Update current ping indicator
    const currentPingElement = document.getElementById('currentPing');
    currentPingElement.textContent = `${data}ms`;
    currentPingElement.className = data < 100 ? 'badge bg-success' : data < 200 ? 'badge bg-warning text-dark' : 'badge bg-danger';
});

// Resource usage updates with enhanced UI (fixed glitching)
socket.on('ResourceUsage', (data) => {
    // Update runtime with animation (prevent excessive animations)
    const runtimeElement = document.getElementById('runtime');
    const newRuntime = data[2];
    if (runtimeElement.textContent !== newRuntime) {
        runtimeElement.textContent = newRuntime;
        runtimeElement.classList.add('count-up');
        setTimeout(() => runtimeElement.classList.remove('count-up'), 300);
    }
    
    // Update CPU usage (prevent unnecessary updates)
    const cpuBar = document.getElementById('cpu');
    const cpuPercent = document.getElementById('cpuPercent');
    const newCpuWidth = `${data[0]}%`;
    const newCpuText = `${data[0]}%`;
    
    if (cpuBar.style.width !== newCpuWidth) {
        cpuBar.style.width = newCpuWidth;
        cpuPercent.textContent = newCpuText;
        cpuPercent.className = data[0] < 70 ? 'badge bg-success' : data[0] < 90 ? 'badge bg-warning text-dark' : 'badge bg-danger';
    }
    
    // Update Memory usage (prevent unnecessary updates)
    const memoryBar = document.getElementById('memory');
    const memoryPercent = document.getElementById('memoryPercent');
    const newMemoryWidth = `${data[1]}%`;
    const newMemoryText = `${data[1]}%`;
    
    if (memoryBar.style.width !== newMemoryWidth) {
        memoryBar.style.width = newMemoryWidth;
        memoryPercent.textContent = newMemoryText;
        memoryPercent.className = data[1] < 70 ? 'badge bg-success' : data[1] < 90 ? 'badge bg-warning text-dark' : 'badge bg-danger';
    }
});

// Version display
socket.on('version', (data) => {
    const versionElement = document.getElementById('ver_webgui');
    if (versionElement.textContent !== `v${data}`) {
        versionElement.textContent = `v${data}`;
    }
});

// Guild and user count updates with animation (fixed glitching)
socket.on('guildsize', (data) => {
    const element = document.getElementById('guildSize');
    if (element.textContent !== data.toString()) {
        element.textContent = data;
        element.classList.add('count-up');
        setTimeout(() => element.classList.remove('count-up'), 300);
    }
});

socket.on('usercount', (data) => {
    const element = document.getElementById('usersCount');
    if (element.textContent !== data.toString()) {
        element.textContent = data;
        element.classList.add('count-up');
        setTimeout(() => element.classList.remove('count-up'), 300);
    }
});

// Enhanced status updates (prevent unnecessary DOM updates)
socket.on('status', (data) => {
    const statusElement = document.getElementById('status');
    const currentStatus = statusElement.querySelector('.badge');
    
    if (data === 0) {
        const newHTML = '<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Online</span>';
        if (!currentStatus || !currentStatus.classList.contains('bg-success')) {
            statusElement.innerHTML = newHTML;
        }
    } else {
        const newHTML = '<span class="badge bg-danger"><i class="bi bi-x-circle-fill me-1"></i>Offline</span>';
        if (!currentStatus || !currentStatus.classList.contains('bg-danger')) {
            statusElement.innerHTML = newHTML;
        }
    }
});

// Session ID display
socket.on('clientid', (data) => {
    const sessionElement = document.getElementById('session_ID');
    const shortId = `Session: ${data.substring(0, 8)}...`;
    if (sessionElement.textContent !== shortId) {
        sessionElement.textContent = shortId;
    }
});

// Enhanced logs with timestamp
const logBox = document.getElementById('logBox');
socket.on('log', (message) => {
    const timestamp = new Date().toLocaleTimeString();
    logBox.value += `[${timestamp}] ${message}\n`;
    logBox.scrollTop = logBox.scrollHeight;
});

// Music update handler
socket.on('musicUpdate', (musicData) => {
    updateMusicPlayer(musicData);
});

// Store progress interval for cleanup
let progressInterval = null;

// Update music player display
function updateMusicPlayer(musicData) {
    const noMusicState = document.getElementById('noMusicState');
    const musicPlayingState = document.getElementById('musicPlayingState');
    const activePlayersCount = document.getElementById('activePlayersCount');
    
    // Update active players count only if changed
    const newPlayerCountText = `${musicData.activePlayersCount} Active Players`;
    if (activePlayersCount.textContent !== newPlayerCountText) {
        activePlayersCount.textContent = newPlayerCountText;
    }
    
    if (musicData.hasActiveMusic && musicData.currentSongs.length > 0) {
        // Show music playing state
        const wasHidden = musicPlayingState.classList.contains('d-none');
        noMusicState.classList.add('d-none');
        musicPlayingState.classList.remove('d-none');
        
        // Get the first current song (you could cycle through multiple)
        const currentSong = musicData.currentSongs[0];
        
        // Update song information only if changed
        const musicTitle = document.getElementById('musicTitle');
        const musicArtist = document.getElementById('musicArtist');
        const musicServer = document.getElementById('musicServer');
        const musicRequestedBy = document.getElementById('musicRequestedBy');
        
        const newTitle = currentSong.title || 'Unknown Title';
        const newArtist = currentSong.Channel || 'Unknown Artist';
        const newServer = currentSong.serverName || 'Unknown Server';
        const newRequestedBy = currentSong.requestedBy || 'Unknown User';
        
        // Check if this is a new song
        const isNewSong = musicTitle.textContent !== newTitle;
        
        if (musicTitle.textContent !== newTitle) {
            musicTitle.textContent = newTitle;
        }
        if (musicArtist.textContent !== newArtist) {
            musicArtist.textContent = newArtist;
        }
        if (musicServer.textContent !== newServer) {
            musicServer.textContent = newServer;
        }
        if (musicRequestedBy.textContent !== newRequestedBy) {
            musicRequestedBy.textContent = newRequestedBy;
        }
        
        // Update thumbnail only if changed
        const thumbnail = document.getElementById('musicThumbnail');
        if (currentSong.image) {
            const newThumbnailSrc = `https://i3.ytimg.com/vi/${currentSong.image}/hqdefault.jpg`;
            if (thumbnail.src !== newThumbnailSrc) {
                thumbnail.src = newThumbnailSrc;
            }
        }
        
        // Update YouTube link only if changed
        const youtubeLink = document.getElementById('musicYoutubeLink');
        if (currentSong.url && youtubeLink.href !== currentSong.url) {
            youtubeLink.href = currentSong.url;
        }
        
        // Update duration
        const duration = formatDuration(currentSong.duration);
        const musicDuration = document.getElementById('musicDuration');
        if (musicDuration.textContent !== duration) {
            musicDuration.textContent = duration;
        }
        
        // Update progress from backend data
        updateProgress(currentSong.elapsedSeconds || 0, currentSong.progressPercent || 0);
        
        // Update queue count only if changed
        const queueCount = document.getElementById('queueCount');
        const newQueueCount = currentSong.queueLength || '0';
        if (queueCount.textContent !== newQueueCount) {
            queueCount.textContent = newQueueCount;
        }
        
        // Update voice users count only if changed
        const voiceUsers = document.getElementById('voiceUsers');
        if (voiceUsers.textContent !== '1') {
            voiceUsers.textContent = '1';
        }
        
        // Only add animation if this is a new song or first time showing
        if (wasHidden || isNewSong) {
            musicPlayingState.classList.add('count-up');
            setTimeout(() => musicPlayingState.classList.remove('count-up'), 300);
        }
        
    } else {
        // Show no music state and stop progress tracking
        noMusicState.classList.remove('d-none');
        musicPlayingState.classList.add('d-none');
        stopProgressTracking();
    }
}

// Update progress bar and current time
function updateProgress(elapsedSeconds, progressPercent) {
    // Update progress bar
    const progressBar = document.getElementById('musicProgress');
    progressBar.style.width = `${Math.min(progressPercent, 100)}%`;
    
    // Update current time display
    const currentTimeElement = document.getElementById('musicCurrentTime');
    currentTimeElement.textContent = formatDuration(Math.floor(elapsedSeconds));
}

// Stop progress tracking (cleanup function)
function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // Reset progress bar
    const progressBar = document.getElementById('musicProgress');
    progressBar.style.width = '0%';
    
    // Reset current time
    const currentTimeElement = document.getElementById('musicCurrentTime');
    currentTimeElement.textContent = '0:00';
}

// Format duration from seconds to MM:SS
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Additional functionality for new UI elements
document.addEventListener('DOMContentLoaded', function() {
    // Initialize bot information
    initializeBotInfo();
    
    // Initialize mock data for demonstration
    initializeMockData();
    
    // Refresh button functionality
    document.getElementById('refreshBtn').addEventListener('click', function() {
        this.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        this.classList.add('loading');
        setTimeout(() => {
            this.classList.remove('loading');
            location.reload();
        }, 1000);
    });
    
    // Clear logs functionality
    document.getElementById('clearLogs').addEventListener('click', function() {
        document.getElementById('logBox').value = '';
    });
    
    // Download logs functionality
    document.getElementById('downloadLogs').addEventListener('click', function() {
        const logs = document.getElementById('logBox').value;
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chiyoko-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    });
    
    // Update activity feed periodically
    setInterval(updateActivityFeed, 30000); // Update every 30 seconds
});

// Initialize bot information
function initializeBotInfo() {
    const botCreated = new Date('2023-01-15');
    document.getElementById('botCreated').textContent = botCreated.toLocaleDateString();
    
    // Initialize placeholder values for new stats
    document.getElementById('commandsToday').textContent = Math.floor(Math.random() * 500) + 100;
    document.getElementById('activeUsers').textContent = Math.floor(Math.random() * 50) + 20;
    document.getElementById('totalCommands').textContent = (Math.floor(Math.random() * 10000) + 5000).toLocaleString();
    document.getElementById('avgResponseTime').textContent = Math.floor(Math.random() * 50) + 50 + 'ms';
    
    // Server overview
    document.getElementById('topServer').textContent = 'Gaming Community';
    document.getElementById('serverDistribution').textContent = '4 regions';
    document.getElementById('largestServer').textContent = '1,234';
    document.getElementById('avgMembers').textContent = '456';
}

// Initialize mock data for demonstration
function initializeMockData() {
    // Command categories (these would come from your bot's actual command structure)
    const commandCounts = {
        music: 5,
        utility: 8,
        moderation: 12,
        fun: 6
    };
    
    document.getElementById('musicCommands').textContent = commandCounts.music;
    document.getElementById('utilityCommands').textContent = commandCounts.utility;
    document.getElementById('moderationCommands').textContent = commandCounts.moderation;
    document.getElementById('funCommands').textContent = commandCounts.fun;
    
    // System health indicators
    updateSystemHealth();
}

// Update system health indicators
function updateSystemHealth() {
    const temperature = Math.floor(Math.random() * 20) + 35; // 35-55°C
    document.getElementById('temperature').textContent = temperature + '°C';
    
    const dbLatency = Math.floor(Math.random() * 5) + 1; // 1-6ms
    document.getElementById('dbLatency').textContent = dbLatency + 'ms';
    
    const uptime = (99.5 + Math.random() * 0.4).toFixed(1); // 99.5-99.9%
    document.getElementById('apiUptime').textContent = uptime + '%';
}

// Update activity feed
function updateActivityFeed() {
    const activities = [
        {
            icon: 'person-plus',
            color: 'success',
            text: 'Bot joined new server',
            server: 'Gaming Community',
            time: Math.floor(Math.random() * 30) + 1
        },
        {
            icon: 'music-note',
            color: 'primary',
            text: 'Music command executed',
            server: 'Chill Lounge',
            time: Math.floor(Math.random() * 30) + 1
        },
        {
            icon: 'shield',
            color: 'warning',
            text: 'Moderation action taken',
            server: 'Main Server',
            time: Math.floor(Math.random() * 30) + 1
        },
        {
            icon: 'gear',
            color: 'info',
            text: 'Settings updated',
            server: 'Development Server',
            time: Math.floor(Math.random() * 30) + 1
        }
    ];
    
    const activityList = document.getElementById('activityList');
    if (activityList) {
        // Randomly select and update one activity
        const randomActivity = activities[Math.floor(Math.random() * activities.length)];
        const activityHTML = `
            <div class="activity-item d-flex align-items-center py-2 border-bottom border-secondary border-opacity-25">
                <div class="activity-icon bg-${randomActivity.color} bg-opacity-20 rounded-circle p-2 me-3">
                    <i class="bi bi-${randomActivity.icon} text-${randomActivity.color}"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="text-white fw-medium">${randomActivity.text}</div>
                    <small class="text-muted">${randomActivity.server} • ${randomActivity.time} minutes ago</small>
                </div>
            </div>
        `;
        
        // Add new activity to top and remove oldest if more than 4
        activityList.insertAdjacentHTML('afterbegin', activityHTML);
        const activities_items = activityList.querySelectorAll('.activity-item');
        if (activities_items.length > 4) {
            activities_items[activities_items.length - 1].remove();
        }
    }
}

// Enhanced counter animation to prevent glitching
function animateCounter(element, newValue, duration = 300) {
    const startValue = parseInt(element.textContent) || 0;
    const endValue = parseInt(newValue);
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
        element.textContent = currentValue.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// Periodically update system health
setInterval(updateSystemHealth, 10000); // Update every 10 seconds

// Console branding (keeping original)
console.log('   _____ _     _             _           _    _                  _         \r\n  \/ ____| |   (_)           | |         | |  | |                | |        \r\n | |    | |__  _ _   _  ___ | | _____   | |__| | __ _ _ __ _   _| | ____ _ \r\n | |    | \'_ \\| | | | |\/ _ \\| |\/ \/ _ \\  |  __  |\/ _` | \'__| | | | |\/ \/ _` |\r\n | |____| | | | | |_| | (_) |   < (_) | | |  | | (_| | |  | |_| |   < (_| |\r\n  \\_____|_| |_|_|\\__, |\\___\/|_|\\_\\___\/  |_|  |_|\\__,_|_|   \\__,_|_|\\_\\__,_|\r\n                  __\/ |                                                    \r\n                 |___\/                                                     ');
console.log(`Welcome, This is Chiyoko's WEBGUI. If you have any questions or need help, please contact me on github: https://github.com/Harleythetech/Chiyoko-Haruka`);
