const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const TwitchScraper = require('../../handlers/twitch/TwitchScraper.js');

// Initialize the scraper (singleton pattern)
let twitchScraper = null;
function getTwitchScraper() {
    if (!twitchScraper) {
        twitchScraper = new TwitchScraper();
    }
    return twitchScraper;
}

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
        const scraper = getTwitchScraper();
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
                    // Test if the Twitch user exists
                    const testResult = await scraper.checkIfLive(username);
                    if (testResult.error === 'User not found') {
                        return await interaction.editReply({
                            content: `❌ Twitch user \`${username}\` not found. Please check the username and try again.`
                        });
                    }

                    const result = scraper.addStreamer(
                        interaction.guild.id,
                        channel.id,
                        username,
                        interaction.user.id
                    );

                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Twitch Streamer Added')
                            .setColor('#00FF00')
                            .setDescription(`**${result.streamer.displayName}** is now being monitored!`)
                            .addFields(
                                { name: '👤 Streamer', value: result.streamer.displayName, inline: true },
                                { name: '📢 Channel', value: `<#${channel.id}>`, inline: true },
                                { name: '👨‍💼 Added by', value: `<@${interaction.user.id}>`, inline: true }
                            )
                            .setThumbnail(`https://static-cdn.jtvnw.net/jtv_user_pictures/default-profile_image-70x70.png`)
                            .setTimestamp();

                        await interaction.editReply({ embeds: [embed] });

                        // Start monitoring if not already started
                        if (!scraper.intervalId) {
                            scraper.startMonitoring(interaction.client);
                        }
                    } else {
                        await interaction.editReply({
                            content: `❌ ${result.message}`
                        });
                    }
                } catch (error) {
                    console.error('[TWITCH COMMAND] Error adding streamer:', error);
                    await interaction.editReply({
                        content: '❌ An error occurred while adding the streamer. Please try again later.'
                    });
                }
                break;
            }

            case 'remove': {
                const username = interaction.options.getString('username').toLowerCase().trim();

                const result = scraper.removeStreamer(interaction.guild.id, username);

                if (result.success) {
                    const embed = new EmbedBuilder()
                        .setTitle('✅ Twitch Streamer Removed')
                        .setColor('#FF4444')
                        .setDescription(`**${result.streamer.displayName}** is no longer being monitored.`)
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                } else {
                    await interaction.reply({
                        content: `❌ ${result.message}`,
                        ephemeral: true
                    });
                }
                break;
            }

            case 'list': {
                const streamers = scraper.getStreamers(interaction.guild.id);

                if (streamers.length === 0) {
                    return await interaction.reply({
                        content: '📭 No Twitch streamers are being monitored in this server.\nUse `/twitch add` to add streamers!',
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📺 Monitored Twitch Streamers')
                    .setColor('#9146FF')
                    .setTimestamp();

                let description = '';
                streamers.forEach((streamer, index) => {
                    const status = streamer.isLive ? '🔴 **LIVE**' : '⚫ Offline';
                    const lastChecked = streamer.lastChecked ? 
                        `<t:${Math.floor(new Date(streamer.lastChecked).getTime() / 1000)}:R>` : 'Never';
                    
                    description += `**${index + 1}.** [${streamer.displayName}](https://twitch.tv/${streamer.username}) - ${status}\n`;
                    description += `└ Last checked: ${lastChecked}\n`;
                    
                    if (streamer.lastStreamTitle && streamer.isLive) {
                        description += `└ **${streamer.lastStreamTitle}**\n`;
                    }
                    if (streamer.lastGameName && streamer.isLive) {
                        description += `└ Playing: ${streamer.lastGameName}\n`;
                    }
                    description += '\n';
                });

                embed.setDescription(description);

                const guildData = scraper.data.guilds[interaction.guild.id];
                if (guildData && guildData.notificationChannelId) {
                    embed.setFooter({ 
                        text: `Notifications sent to: #${interaction.guild.channels.cache.get(guildData.notificationChannelId)?.name || 'Unknown'}` 
                    });
                }

                await interaction.reply({ embeds: [embed] });
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

                const result = scraper.setNotificationChannel(interaction.guild.id, channel.id);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Notification Channel Updated')
                    .setColor('#00FF00')
                    .setDescription(`Twitch live notifications will now be sent to <#${channel.id}>`)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'check': {
                const username = interaction.options.getString('username').toLowerCase().trim();

                await interaction.deferReply();

                try {
                    const streamData = await scraper.checkIfLive(username);

                    const embed = new EmbedBuilder()
                        .setTitle(`📺 ${username} - Stream Status`)
                        .setURL(`https://twitch.tv/${username}`)
                        .setColor(streamData.isLive ? '#00FF00' : '#FF4444')
                        .setTimestamp();

                    if (streamData.error) {
                        embed.setDescription(`❌ Error: ${streamData.error}`);
                    } else if (streamData.isLive) {
                        embed.setDescription('🔴 **CURRENTLY LIVE!**');
                        
                        if (streamData.title) {
                            embed.addFields({ name: '📝 Stream Title', value: streamData.title, inline: false });
                        }
                        if (streamData.game) {
                            embed.addFields({ name: '🎮 Game/Category', value: streamData.game, inline: true });
                        }
                        if (streamData.viewers) {
                            embed.addFields({ name: '👥 Viewers', value: streamData.viewers, inline: true });
                        }
                        if (streamData.thumbnail) {
                            embed.setImage(streamData.thumbnail);
                        }
                    } else {
                        embed.setDescription('⚫ **Currently Offline**');
                    }

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
                const stats = scraper.getStats();

                const embed = new EmbedBuilder()
                    .setTitle('📊 Twitch Monitoring Statistics')
                    .setColor('#9146FF')
                    .addFields(
                        { name: '🏠 Servers', value: stats.totalGuilds.toString(), inline: true },
                        { name: '👥 Total Streamers', value: stats.totalStreamers.toString(), inline: true },
                        { name: '🔴 Currently Live', value: stats.liveStreamers.toString(), inline: true },
                        { name: '⏱️ Check Interval', value: `${stats.checkInterval / 1000 / 60} minutes`, inline: true },
                        { name: '🤖 Monitoring Status', value: stats.isMonitoring ? '✅ Active' : '❌ Inactive', inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }
        }
    }
};

// Export the scraper instance for use in other parts of the application
module.exports.getTwitchScraper = getTwitchScraper;
