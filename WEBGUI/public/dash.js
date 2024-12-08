const socket = io();

const ctx = document.getElementById('ping_chart').getContext('2d');

const pingData = {
    datasets: [{
        label: 'Ping (ms)',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        fill: true,
    }]
};

const pingChart = new Chart(ctx, {
    type: 'line',
    data: pingData,
    plugins: {
        legend: {
            display: false,
            position: 'top',
        }
    },
    options: {
        responsive: true,
        scales: {
            x: {
                display: false // Hides the X-axis entirely
            },
            y: {
                title: { display: true, text: 'Ping (ms)' },
                beginAtZero: true,
            },
        },
    },
});

socket.on('heartbeat', (data) => {
    const now = new Date().toLocaleTimeString();

    // Update the chart
    if (pingData.labels.length > 10) { // Keep only 20 points for clarity
        pingData.labels.shift();
        pingData.datasets[0].data.shift();
    }
    pingData.labels.push(now);
    pingData.datasets[0].data.push(data);
    pingChart.update();
});

// Resource updates
socket.on('ResourceUsage', (data) => {
    document.getElementById('runtime').innerText = `Runtime: ${data[2]}`;
    document.getElementById('cpu').style.width = `${data[0]}%`;
    document.getElementById('memory').style.width = `${data[1]}%`;
    document.getElementById('cpu').innerText = `${data[0]}%`;
    document.getElementById('memory').innerText = `${data[1]}%`;
});

// Logs
const logBox = document.getElementById('logBox');
socket.on('log', (message) => {
    logBox.value += `${message}\n`;
    logBox.scrollTop = logBox.scrollHeight;
});

console.log('   _____ _     _             _           _    _                  _         \r\n  \/ ____| |   (_)           | |         | |  | |                | |        \r\n | |    | |__  _ _   _  ___ | | _____   | |__| | __ _ _ __ _   _| | ____ _ \r\n | |    | \'_ \\| | | | |\/ _ \\| |\/ \/ _ \\  |  __  |\/ _` | \'__| | | | |\/ \/ _` |\r\n | |____| | | | | |_| | (_) |   < (_) | | |  | | (_| | |  | |_| |   < (_| |\r\n  \\_____|_| |_|_|\\__, |\\___\/|_|\\_\\___\/  |_|  |_|\\__,_|_|   \\__,_|_|\\_\\__,_|\r\n                  __\/ |                                                    \r\n                 |___\/                                                     ');
console.log(`Welcome, This is Chiyoko's WEBGUI. If you have any questions or need help, please contact me on github: https://github.com/Harleythetech/Chiyoko-Haruka`);
