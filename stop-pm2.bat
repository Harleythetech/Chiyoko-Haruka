@echo off
echo Stopping Chiyoko-Haruka Discord Bot...

REM Stop the PM2 process
pm2 stop chiyoko-haruka-discord-bot

REM Show PM2 status
pm2 status

echo Bot stopped successfully.
pause
