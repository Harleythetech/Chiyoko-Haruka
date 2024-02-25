pm2_res="/home/xceon/.nvm/versions/node/v20.2.0/bin/pm2"
pm2_script="/home/xceon/network-share/ecosystem.config.js"

# Reload PM2 Script (ecosystem.config.js)
reloader(){
    # Notify User
    echo "Reloading Ecosystem Configuration"
    "$pm2_res" reload "$pm2_script"
    sleep 2
}

restartsys(){
    echo "Restarting All Bots - PM2"
    "$pm2_res" restart all
}

# Reload First
reloader
# Restart Bots
restartsys
