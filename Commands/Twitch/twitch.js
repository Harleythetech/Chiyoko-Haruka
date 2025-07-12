const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

// Get the WebGUI base URL (assuming it's running on the same server)
const WEBGUI_BASE_URL = `http://127.0.0.1:${process.env.PORT}`;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('Manage Twitch stream notifications')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a Twitch streamer to monitor')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username to monitor')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Discord channel to send notifications to')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a Twitch streamer from monitoring')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username to stop monitoring')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all monitored Twitch streamers'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set the notification channel for this server')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Discord channel to send notifications to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Manually check if a streamer is live')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username to check')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show Twitch monitoring statistics')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // Check permissions for most commands (except stats)
        if (subcommand !== 'stats' && subcommand !== 'list') {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels) && 
                !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: '❌ You need **Manage Channels** or **Administrator** permissions to use this command.',
                    ephemeral: true
                });
            }
        }

        switch (subcommand) {
            case 'add': {
                const username = interaction.options.getString('username').toLowerCase().trim();
                const channel = interaction.options.getChannel('channel') || interaction.channel;

                if (channel.type !== 0) { // 0 = GUILD_TEXT
                    return await interaction.reply({
                        content: '❌ Notifications can only be sent to text channels.',
                        ephemeral: true
                    });
                }

                await interaction.deferReply();

                try {
                    // Use the WebGUI API to add the streamer
                    const response = await axios.post(`${WEBGUI_BASE_URL}/api/twitch/guild/${interaction.guild.id}/add`, {
                        username: username,
                        channelId: channel.id
                    }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    });

                    const result = response.data;

                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor(0x9146FF)
                            .setAuthor({
                                name: `${result.streamer.username} added to monitoring`, 
                                iconURL: 'https://github.com/Harleythetech/Chiyoko-Haruka/blob/main/handlers/img/glitch_flat_purple.png?raw=true'
                            })
                            .setTitle(`✅ Now monitoring @${result.streamer.username}`)
                            .setURL(`https://www.twitch.tv/${result.streamer.username}`)
                            .setDescription(`Live notifications will be sent to <#${channel.id}>`)
                            .addFields(
                                { name: '👤 Streamer', value: `[@${result.streamer.username}](https://twitch.tv/${result.streamer.username})`, inline: true },
                                { name: '📢 Channel', value: `<#${channel.id}>`, inline: true },
                                { name: '👨‍💼 Added by', value: `<@${interaction.user.id}>`, inline: true }
                            )
                            .setThumbnail(`https://static-cdn.jtvnw.net/jtv_user_pictures/default-profile_image-70x70.png`)
                            .setTimestamp()
                            .setFooter({
                                text: 'Chiyoko Haruka • Twitch Management',
                                iconURL: 'https://i.imgur.com/mwOFCBO.png'
                            });

                        await interaction.editReply({ embeds: [embed] });
                    } else {
                        await interaction.editReply({
                            content: `❌ ${result.message || result.error}`
                        });
                    }
                } catch (error) {
                    console.error('[TWITCH COMMAND] Error adding streamer via API:', error);
                    
                    if (error.response?.data?.message) {
                        await interaction.editReply({
                            content: `❌ ${error.response.data.message}`
                        });
                    } else {
                        await interaction.editReply({
                            content: '❌ An error occurred while adding the streamer. Please try again later.'
                        });
                    }
                }
                break;
            }

            case 'remove': {
                const username = interaction.options.getString('username').toLowerCase().trim();

                try {
                    // Use the WebGUI API to remove the streamer
                    const response = await axios.post(`${WEBGUI_BASE_URL}/api/twitch/guild/${interaction.guild.id}/remove`, {
                        username: username
                    }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    });

                    const result = response.data;

                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor(0x9146FF)
                            .setAuthor({
                                name: `${result.streamer.username} removed from monitoring`, 
                                iconURL: 'https://github.com/Harleythetech/Chiyoko-Haruka/blob/main/handlers/img/glitch_flat_purple.png?raw=true'
                            })
                            .setTitle(`❌ No longer monitoring @${result.streamer.username}`)
                            .setURL(`https://www.twitch.tv/${result.streamer.username}`)
                            .setDescription('This streamer has been removed from the monitoring list')
                            .setTimestamp()
                            .setFooter({
                                text: 'Chiyoko Haruka • Twitch Management',
                                iconURL: 'https://i.imgur.com/mwOFCBO.png'
                            });

                        await interaction.reply({ embeds: [embed] });
                    } else {
                        await interaction.reply({
                            content: `❌ ${result.message || result.error}`,
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error('[TWITCH COMMAND] Error removing streamer via API:', error);
                    await interaction.reply({
                        content: '❌ An error occurred while removing the streamer. Please try again later.',
                        ephemeral: true
                    });
                }
                break;
            }

            case 'list': {
                try {
                    // Use the WebGUI API to get streamers
                    const response = await axios.get(`${WEBGUI_BASE_URL}/api/twitch/guild/${interaction.guild.id}`, {
                        timeout: 10000
                    });

                    const data = response.data;
                    const streamers = data.streamers || [];

                    if (streamers.length === 0) {
                        return await interaction.reply({
                            content: '📭 No Twitch streamers are being monitored in this server.\nUse `/twitch add` to add streamers!',
                            ephemeral: true
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x9146FF)
                        .setAuthor({
                            name: 'Twitch Monitoring Status', 
                            iconURL: 'https://github.com/Harleythetech/Chiyoko-Haruka/blob/main/handlers/img/glitch_flat_purple.png?raw=true'
                        })
                        .setTitle('📺 Monitored Streamers')
                        .setTimestamp()
                        .setFooter({
                            text: 'Chiyoko Haruka • Twitch Management',
                            iconURL: 'https://i.imgur.com/mwOFCBO.png'
                        });

                    let description = '';
                    streamers.forEach((streamer, index) => {
                        const status = streamer.isLive ? '🔴 **LIVE**' : '⚫ Offline';
                        const lastChecked = streamer.lastChecked ? 
                            `<t:${Math.floor(new Date(streamer.lastChecked).getTime() / 1000)}:R>` : 'Never';
                        
                        // Show stream title if available, otherwise username
                        const displayName = streamer.lastStreamTitle || `@${streamer.username}`;
                        
                        description += `**${index + 1}.** [${displayName}](https://twitch.tv/${streamer.username}) - ${status}\n`;
                        description += `└ @${streamer.username}${streamer.lastGameName ? ` | ${streamer.lastGameName}` : ''}\n`;
                        description += `└ Last checked: ${lastChecked}\n`;
                        description += '\n';
                    });

                    embed.setDescription(description);

                    if (data.notificationChannelId) {
                        embed.setFooter({ 
                            text: `Notifications sent to: #${interaction.guild.channels.cache.get(data.notificationChannelId)?.name || 'Unknown'}` 
                        });
                    }

                    await interaction.reply({ embeds: [embed] });
                } catch (error) {
                    console.error('[TWITCH COMMAND] Error fetching streamers via API:', error);
                    await interaction.reply({
                        content: '❌ An error occurred while fetching streamers. Please try again later.',
                        ephemeral: true
                    });
                }
                break;
            }

            case 'channel': {
                const channel = interaction.options.getChannel('channel');

                if (channel.type !== 0) { // 0 = GUILD_TEXT
                    return await interaction.reply({
                        content: '❌ Notifications can only be sent to text channels.',
                        ephemeral: true
                    });
                }

                try {
                    // Use the WebGUI API to set notification channel
                    const response = await axios.post(`${WEBGUI_BASE_URL}/api/twitch/guild/${interaction.guild.id}/channel`, {
                        channelId: channel.id
                    }, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    });

                    const result = response.data;

                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor(0x9146FF)
                            .setAuthor({
                                name: 'Notification channel updated', 
                                iconURL: 'https://github.com/Harleythetech/Chiyoko-Haruka/blob/main/handlers/img/glitch_flat_purple.png?raw=true'
                            })
                            .setTitle('📢 Channel Configuration')
                            .setDescription(`Twitch live notifications will now be sent to <#${channel.id}>`)
                            .addFields(
                                { name: '📺 Channel', value: `<#${channel.id}>`, inline: true },
                                { name: '👨‍💼 Updated by', value: `<@${interaction.user.id}>`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({
                                text: 'Chiyoko Haruka • Twitch Management',
                                iconURL: 'https://i.imgur.com/mwOFCBO.png'
                            });

                        await interaction.reply({ embeds: [embed] });
                    } else {
                        await interaction.reply({
                            content: `❌ ${result.message || result.error}`,
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error('[TWITCH COMMAND] Error setting channel via API:', error);
                    await interaction.reply({
                        content: '❌ An error occurred while setting the channel. Please try again later.',
                        ephemeral: true
                    });
                }
                break;
            }

            case 'check': {
                const username = interaction.options.getString('username').toLowerCase().trim();

                await interaction.deferReply();

                try {
                    // For the check command, we still use direct scraper access since it's read-only
                    const TwitchScraper = require('../../handlers/twitch/TwitchScraper.js');
                    const scraper = new TwitchScraper();
                    const streamData = await scraper.checkIfLive(username);

                    const embed = new EmbedBuilder()
                        .setColor(streamData.isLive ? 0x9146FF : 0x6C7B7F)
                        .setAuthor({
                            name: streamData.isLive ? `${username} is currently live!` : `${username} is offline`, 
                            iconURL: 'https://github.com/Harleythetech/Chiyoko-Haruka/blob/main/handlers/img/glitch_flat_purple.png?raw=true'
                        })
                        .setTitle(streamData.title || `@${username}`)
                        .setURL(`https://twitch.tv/${username}`)
                        .setTimestamp()
                        .setFooter({
                            text: 'Chiyoko Haruka • Twitch Status Check',
                            iconURL: 'https://i.imgur.com/mwOFCBO.png'
                        });

                    if (streamData.error) {
                        embed.setDescription(`❌ Error: ${streamData.error}`);
                    } else if (streamData.isLive) {
                        // Add game field if available
                        if (streamData.game) {
                            embed.addFields({
                                name: '🎮 Playing',
                                value: streamData.game,
                                inline: true
                            });
                        }

                        // Add viewer count if available
                        if (streamData.viewers) {
                            embed.addFields({
                                name: '👥 Viewers',
                                value: streamData.viewers.toLocaleString(),
                                inline: true
                            });
                        }

                        // Add uptime if available
                        if (streamData.uptime) {
                            const hours = Math.floor(streamData.uptime / 60);
                            const minutes = streamData.uptime % 60;
                            const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                            embed.addFields({
                                name: '⏱️ Uptime',
                                value: uptimeStr,
                                inline: true
                            });
                        }

                        // Set live preview image
                        embed.setImage(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${username}-1280x720.jpg`);
                    } else {
                        embed.setDescription('⚫ Currently offline - no recent stream activity');
                    }

                    // Set profile image as thumbnail
                    if (streamData.profileImage) {
                        embed.setThumbnail(streamData.profileImage);
                    }

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error('[TWITCH COMMAND] Error checking streamer:', error);
                    await interaction.editReply({
                        content: '❌ An error occurred while checking the streamer. Please try again later.'
                    });
                }
                break;
            }

            case 'stats': {
                try {
                    // Use the WebGUI API to get stats
                    const response = await axios.get(`${WEBGUI_BASE_URL}/api/twitch/stats`, {
                        timeout: 10000
                    });

                    const stats = response.data;

                    const embed = new EmbedBuilder()
                        .setColor(0x9146FF)
                        .setAuthor({
                            name: 'Twitch Monitoring Statistics', 
                            iconURL: 'https://github.com/Harleythetech/Chiyoko-Haruka/blob/main/handlers/img/glitch_flat_purple.png?raw=true'
                        })
                        .setTitle('📊 System Status')
                        .setTimestamp()
                        .setFooter({
                            text: 'Chiyoko Haruka • Twitch Management',
                            iconURL: 'https://i.imgur.com/mwOFCBO.png'
                        })
                        .addFields(
                            { name: '🏠 Servers', value: stats.totalGuilds.toString(), inline: true },
                            { name: '👥 Total Streamers', value: stats.totalStreamers.toString(), inline: true },
                            { name: '🔴 Currently Live', value: stats.liveStreamers.toString(), inline: true },
                            { name: '⏱️ Check Interval', value: `${10} seconds`, inline: true },
                            { name: '🤖 Monitoring Status', value: stats.isMonitoring ? '✅ Active' : '❌ Inactive', inline: true }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                } catch (error) {
                    console.error('[TWITCH COMMAND] Error fetching stats via API:', error);
                    await interaction.reply({
                        content: '❌ An error occurred while fetching statistics. Please try again later.',
                        ephemeral: true
                    });
                }
                break;
            }
        }
    }
};
