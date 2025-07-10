@echo off
setlocal enabledelayedexpansion

:menu
echo.
echo ================================
echo   Chiyoko-Haruka PM2 Manager
echo ================================
echo 1. Start Bot
echo 2. Stop Bot
echo 3. Restart Bot
echo 4. View Status
echo 5. View Logs (Live)
echo 6. View Error Logs
echo 7. Monitor Resources
echo 8. Delete Process
echo 9. Reload Process
echo 0. Exit
echo ================================

set /p choice="Enter your choice (0-9): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto status
if "%choice%"=="5" goto logs
if "%choice%"=="6" goto errorlogs
if "%choice%"=="7" goto monitor
if "%choice%"=="8" goto delete
if "%choice%"=="9" goto reload
if "%choice%"=="0" goto exit

echo Invalid choice. Please try again.
goto menu

:start
echo Starting Chiyoko-Haruka Discord Bot...
pm2 start ecosystem.config.js
goto menu

:stop
echo Stopping Chiyoko-Haruka Discord Bot...
pm2 stop chiyoko-haruka-discord-bot
goto menu

:restart
echo Restarting Chiyoko-Haruka Discord Bot...
pm2 restart chiyoko-haruka-discord-bot
goto menu

:status
echo Current PM2 Status:
pm2 status
pause
goto menu

:logs
echo Showing live logs (Press Ctrl+C to exit logs)...
pm2 logs chiyoko-haruka-discord-bot
goto menu

:errorlogs
echo Showing error logs...
pm2 logs chiyoko-haruka-discord-bot --err
pause
goto menu

:monitor
echo Opening PM2 Monitor (Press Ctrl+C to exit)...
pm2 monit
goto menu

:delete
echo Deleting PM2 process...
pm2 delete chiyoko-haruka-discord-bot
goto menu

:reload
echo Reloading process with zero downtime...
pm2 reload chiyoko-haruka-discord-bot
goto menu

:exit
echo Goodbye!
exit /b 0
