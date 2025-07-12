<p align="center"><img src="https://i.imgur.com/mwOFCBO.png" width="260" height="220"></p>

### <p align="center">Chiyoko Haruka - V13.3.1-Catalyst</p>

---

[![Node.js](https://img.shields.io/badge/Node.js-16.x+-green.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.20.0-blue.svg)](https://discord.js.org/)
[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](LICENSE)
[![PM2](https://img.shields.io/badge/PM2-Ready-brightgreen.svg)](https://pm2.keymetrics.io/)

## 📖 About

**Chiyoko Haruka** is a feature-rich Discord bot designed to enhance your server experience with entertainment, utility, and music functionality. Built with Discord.js v14 and featuring a modern web dashboard, this bot combines reliability with extensive customization options.

### ✨ Key Features

- 🎵 **Advanced Music System** - High-quality audio streaming with queue management
- 🌐 **Web Dashboard** - Real-time monitoring and control interface
- 🛠️ **Utility Commands** - Server management and information tools
- 🎭 **Entertainment Features** - Interactive commands and content sharing
- 📊 **Resource Monitoring** - Built-in performance tracking
- 🔄 **Auto-restart** - PM2 ecosystem for production reliability

---

## 🎵 Music Features

- **YouTube Integration** - Stream music directly from YouTube
- **Queue Management** - Add, remove, and organize your playlist
- **Mix Support** - YouTube Mix and playlist integration
- **Voice Controls** - Play, pause, skip, and volume controls
- **Multiple Servers** - Simultaneous playback across different servers
- **Download Options** - Save your favorite tracks locally

## 🛠️ Utility Commands

| Command | Description |
|---------|-------------|
| `/ping` | Check bot latency and response time |
| `/info` | Display bot information and statistics |
| `/serverinfo` | Get detailed server information |
| `/userinfo` | View user profile and statistics |
| `/invite` | Generate bot invite link |

## 🌐 Web Dashboard

Access the built-in web interface at `http://localhost:3000` (or your configured port) to:

- 📈 Monitor bot performance and resource usage
- 🎵 Control music playback across servers
- 📊 View real-time statistics and logs
- 🖥️ Check system information and uptime
- 👥 Track active voice connections

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v16.x or higher)
- [Git](https://git-scm.com/)
- [Discord Developer Portal](https://discord.com/developers/) access
- Code editor ([VSCode](https://code.visualstudio.com/) recommended)

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Harleythetech/Chiyoko-Haruka.git
   cd Chiyoko-Haruka
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Discord Application**

   Go to [Discord Developer Portal](https://discord.com/developers/) and create a new application:

   ![Discord Application Creation](https://user-images.githubusercontent.com/51787264/232237205-36f868bb-df87-4dda-94ee-99502595ac70.png)

4. **Generate Bot Invite Link**

   Navigate to OAuth2 > URL Generator and configure permissions:

   ![OAuth2 Configuration](https://user-images.githubusercontent.com/51787264/232237406-0ab32b23-810e-4fab-9078-fd2032f2e6cb.png)

   **Recommended Permissions:**
   - Read Messages/View Channels
   - Send Messages
   - Connect (for voice)
   - Speak (for music)
   - Use Slash Commands

   ![Permission Selection](https://user-images.githubusercontent.com/51787264/232237482-dc5f915f-fb93-44fc-8c7b-e25d03a13c21.png)

5. **Environment Configuration**

   Create a `.env` file in the project root:

   ```env
   # Discord Bot Configuration
   TOKEN=your_bot_token_here
   APP_ID=your_application_id_here
   GUILD_ID=your_guild_id_here
   CHANNEL_ID=your_log_channel_id_here
   
   # Web Dashboard (Optional)
   PORT=3000
   ```

   **How to get these values:**
   - **TOKEN**: Bot section > Reset Token
   - **APP_ID**: General Information > Application ID
   - **GUILD_ID**: Enable Developer Mode > Right-click server > Copy ID
   - **CHANNEL_ID**: Enable Developer Mode > Right-click channel > Copy ID

6. **Deploy Commands**
   ```bash
   node CommandPush.js
   ```

---

## 🏃 Running the Bot

### Development Mode
```bash
npm start
# or
node index.js
```

### Production with PM2 (Recommended)

**Quick Start:**
```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem
pm2 start ecosystem.config.js

# View status
pm2 status
```

**Using Helper Scripts:**
```bash
# Windows users can use the provided batch files
.\start-pm2.bat          # Start the bot
.\stop-pm2.bat           # Stop the bot
.\pm2-manager.bat        # Interactive management menu
```

### PM2 Management Commands

```bash
# Process Control
pm2 start Chiyoko-Haruka     # Start the bot
pm2 stop Chiyoko-Haruka      # Stop the bot
pm2 restart Chiyoko-Haruka   # Restart the bot
pm2 reload Chiyoko-Haruka    # Zero-downtime reload

# Monitoring
pm2 status                   # View process status
pm2 logs Chiyoko-Haruka     # View logs
pm2 monit                   # Resource monitor

# Advanced
pm2 save                    # Save current processes
pm2 startup                 # Enable auto-start on boot
```

---

## 📁 Project Structure

```
Chiyoko-Haruka/
├── Commands/                 # Bot commands
│   ├── media/               # Music-related commands
│   │   ├── MusicPlayer.js   # Main music functionality
│   │   ├── PlayStatus.js    # Playback status commands
│   │   └── modules/         # Music system modules
│   └── Utility/             # Utility commands
│       ├── info.js          # Bot information
│       ├── invite.js        # Invite link generation
│       ├── ping.js          # Latency checking
│       ├── serverinfo.js    # Server information
│       └── userinfo.js      # User information
├── WEBGUI/                  # Web dashboard
│   ├── public/              # Static files
│   └── views/               # EJS templates
├── handlers/                # Configuration and utilities
│   ├── config.json          # Bot configuration
│   └── embed.js             # Message embeds
├── logs/                    # PM2 log files
├── downloads/               # Temporary music files
├── .env                     # Environment variables
├── ecosystem.config.js      # PM2 configuration
├── index.js                 # Main application file
└── CommandPush.js           # Slash command deployment
```

---

## ⚙️ Configuration

### Bot Configuration (`handlers/config.json`)
```json
{
  "BOT_VERSION": "10.0.0-Catalyst",
  "INVLINK": "your_bot_invite_link_here"
}
```

### PM2 Ecosystem (`ecosystem.config.js`)

The bot includes a production-ready PM2 configuration with:
- **High Process Priority** - Optimized performance
- **Auto-restart** - Automatic recovery from crashes
- **Memory Management** - 712MB limit with smart restart
- **Logging** - Comprehensive log rotation
- **Health Monitoring** - Resource usage tracking

---

## 🔧 Troubleshooting

### Common Issues

**Bot not responding:**
- Verify bot token in `.env` file
- Check if bot has necessary permissions
- Ensure slash commands are deployed with `CommandPush.js`

**Music not working:**
- Verify voice channel permissions
- Check if bot can connect to voice channels
- Ensure FFmpeg is installed (usually bundled with Node.js)

**PM2 issues:**
- Install PM2 globally: `npm install -g pm2`
- Check logs: `pm2 logs Chiyoko-Haruka`
- Restart PM2: `pm2 restart ecosystem.config.js`

### Support

- 📝 [Create an Issue](https://github.com/Harleythetech/Chiyoko-Haruka/issues)
- 📖 [View Documentation](https://github.com/Harleythetech/Chiyoko-Haruka/wiki)
- 💬 [Discord Support Server](#) *(Link to be added)*

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Discord API wrapper
- [PM2](https://pm2.keymetrics.io/) - Process management
- [Express.js](https://expressjs.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time communication

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Harleythetech">Harleythetech</a>
</p>
