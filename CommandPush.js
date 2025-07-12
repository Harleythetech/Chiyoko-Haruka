const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('readline-sync');
const cliProgress = require('cli-progress');
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
const input = readline.question(
    "Select How to Push the Command: \n1. Push to Testing\n2. Push to Global\n3. Clear Commands\n4. Exit \n\nInput: "
);

switch (input) {
    case "1": // Push to Testing
        (async () => {
            try {
                const rest = new REST().setToken(process.env.TOKEN);
                const bar = new cliProgress.SingleBar({
                    format: 'Uploading Commands to Testing [{bar}] {percentage}% | {value}/{total}',
                    fps: 30,
                    barCompleteChar: '\u2588',
                    barIncompleteChar: '\u2591'
                }, cliProgress.Presets.rect);

                console.log(`\nStarted refreshing ${commands.length} application (/) commands.`);
                bar.start(commands.length, 0);

                // Push commands
                const data = await rest.put(
                    Routes.applicationGuildCommands(ClientId, GuildId),
                    { body: commands }
                );

                bar.update(commands.length);
                bar.stop();

                process.stdout.write(
                    `\n[SUCCESS - PUSH TEST COMMANDS] Successfully reloaded ${data.length} application (/) commands.\n`
                );
                process.exit(0);
            } catch (error) {
                process.stdout.write(`\n[ERROR - PUSH TEST COMMANDS] ${error}\n`);
            }
        })();
        break;

    case "2": // Push to Global
        (async () => {
            try {
                const rest = new REST().setToken(process.env.TOKEN);
                const bar = new cliProgress.SingleBar({
                    format: 'Uploading Global Commands [{bar}] {percentage}% | {value}/{total}',
                    fps: 30,
                    barCompleteChar: '\u2588',
                    barIncompleteChar: '\u2591'
                }, cliProgress.Presets.rect);

                console.log(`\nStarted refreshing ${commands.length} global application (/) commands.`);
                bar.start(commands.length, 0);

                // Push commands
                const data = await rest.put(
                    Routes.applicationCommands(ClientId),
                    { body: commands }
                );

                bar.update(commands.length);
                bar.stop();

                process.stdout.write(
                    `\n[SUCCESS - PUSH GLOBAL COMMANDS] Successfully reloaded ${data.length} application (/) commands.\n`
                );
                process.exit(0);
            } catch (error) {
                process.stdout.write(`\n[ERROR - PUSH GLOBAL COMMANDS] ${error}\n`);
            }
        })();
        break;

    case "3": // Clear Commands
        (async () => {
            try {
                const rest = new REST().setToken(process.env.TOKEN);

                // Fetch guild and global commands
                const guildCommands = await rest.get(
                    Routes.applicationGuildCommands(ClientId, GuildId)
                );
                const globalCommands = await rest.get(
                    Routes.applicationCommands(ClientId)
                );

                const totalCommands = guildCommands.length + globalCommands.length;
                if (totalCommands === 0) {
                    console.log("[INFO - CLEAR COMMANDS] No commands to delete.");
                    return;
                }

                const bar = new cliProgress.SingleBar({
                    format: 'Deleting Commands [{bar}] {percentage}% | {value}/{total}',
                    fps: 30,
                    barCompleteChar: '\u2588',
                    barIncompleteChar: '\u2591'
                }, cliProgress.Presets.rect);

                bar.start(totalCommands, 0);

                let count = 0;

                // Delete guild-specific commands
                for (const command of guildCommands) {
                    await rest.delete(
                        Routes.applicationGuildCommand(ClientId, GuildId, command.id)
                    );
                    count++;
                    bar.update(count);
                }

                // Delete global commands
                for (const command of globalCommands) {
                    await rest.delete(
                        Routes.applicationCommand(ClientId, command.id)
                    );
                    count++;
                    bar.update(count);
                }

                bar.stop();

                process.stdout.write("\n[SUCCESS - CLEAR COMMANDS] All commands have been deleted.\n");
                process.exit(0);
            } catch (error) {
                process.stdout.write(`\n[ERROR - CLEAR COMMANDS] ${error}\n`);
            }
        })();
        break;

    case "4": // Exit
        console.log("Exiting...");
        process.exit(0);

    default:
        console.log("Invalid Option");
}
