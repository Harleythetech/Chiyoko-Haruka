#!/bin/bash

# Directory of bot
CH_DIR="/home/Harleythetech/chb/Chiyoko-Haruka"

# Remove Duplicate Session to start a new one
remsess(){
        # Check if session chiyo exists
        echo "[LOG] Checking for existing session and sending SIGKILL..."
        if tmux has-session -t chiyo 2>/dev/null; then
        tmux kill-session -t chiyo

        # wait for it to close the session
        sleep 2
        fi
}

# Run the bot forever and prevent it from dying.
chiyo(){
        # Starting tmux & chiyoko
        echo "[LOG] Starting tmux session and starting chiyoko..."

        # Run tmux with the DIR set to Chiyoko's DIR
        tmux new-session -d -s chiyo -c "$CH_DIR"

        # Run Chiyoko with the neccessary files loaded
        tmux send-keys -t chiyo "node index.js" Enter
}

# where the loop happens
while true; do
        # duplicate session check
        remsess
        # start chiyoko again
        chiyo

        #pause for 4 hours before restarting
        sleep 14400
        echo "Restarting....."
done

