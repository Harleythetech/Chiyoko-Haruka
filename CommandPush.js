const {REST, Routes} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('readline-sync');
require('dotenv').config();
const ClientId = process.env.APP_ID;
const GuildId = process.env.GUILD_ID;

// Command Handler
const commands = [];
const folderPath = path.join(__dirname, 'Commands');
const commandFolders = fs.readdirSync(folderPath);
for (const folder of commandFolders) {
    const cmdpath = path.join(folderPath, folder);
    const cmdfs = fs.readdirSync(cmdpath).filter(file => file.endsWith('.js'));
    for (const file of cmdfs) {
        const fspath = path.join(cmdpath, file);
        const cmd = require(fspath);
        if ('data' in cmd && 'execute' in cmd) {
            commands.push(cmd.data.toJSON());
        } else {
            console.log(`[WARNING - COMMAND HANDLER] The command at ${fspath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Input for Pushing the Command
const input = readline.question("Select How to Push the Command: \n1. Push to Testing\n2. Push to Global\n3. Exit \n\nInput: ");
switch (input) {
    case "1":
        (async () => {
            try {
                const test = new REST().setToken(process.env.TOKEN);
                console.log(`Started refreshing ${commands.length} application (/) commands.`);
                const data = await test.put(
                    Routes.applicationGuildCommands(ClientId, GuildId), { body: commands }
                );
                console.log(`Successfully reloaded ${data.length} application (/) commands.`);
            } catch (error) {
                console.error(`[ERROR - PUSH TEST COMMANDS] ${error}`);
            }
        })();
        break; 
    case "2":
        (async () => {
            try {
                const rest = new REST().setToken(process.env.TOKEN);
                console.log(`Started refreshing ${commands.length} application (/) commands.`);
        
                // The put method is used to fully refresh all commands in the guild with the current set
                const data = await rest.put(
                    Routes.applicationCommands(ClientId),
                    { body: commands },
                );
        
                console.log(`Successfully reloaded ${data.length} application (/) commands.`);
            } catch (error) {
                // And of course, make sure you catch and log any errors!
                console.error(`[ERROR - PUSH GLOBAL COMMANDS] ${error}`);
            }
        })();
        break; 
    case "3":
        console.log("Exiting...");
        process.exit(0);
    default:
        console.log("Invalid Option");
}