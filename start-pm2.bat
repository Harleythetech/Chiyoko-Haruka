@echo off
echo Starting Chiyoko-Haruka Discord Bot with PM2...

REM Install PM2 globally if not already installed
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo PM2 not found. Installing PM2 globally...
    npm install -g pm2
)

REM Create logs directory if it doesn't exist
if not exist "logs" (
    mkdir logs
)

REM Start the application using PM2 ecosystem
echo Starting application with PM2 ecosystem configuration...
pm2 start ecosystem.config.js

REM Show PM2 status
pm2 status

REM Show logs
echo.
echo To view logs, use: pm2 logs chiyoko-haruka-discord-bot
echo To stop the bot, use: pm2 stop chiyoko-haruka-discord-bot
echo To restart the bot, use: pm2 restart chiyoko-haruka-discord-bot
echo To monitor the bot, use: pm2 monit

pause
