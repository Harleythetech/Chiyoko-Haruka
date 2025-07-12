const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const config = require('../../handlers/config.json');
const { bug } = require('../../handlers/embed.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands and how to use them')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Specific command category to view')
                .setRequired(false)
                .addChoices(
                    { name: 'General', value: 'general' },
                    { name: 'Music', value: 'music' },
                    { name: 'Twitch', value: 'twitch' },
                    { name: 'Utility', value: 'utility' }
                )),

    async execute(interaction) {
        try {
            const specificCategory = interaction.options.getString('category');
            
            // Define command categories
            const commandCategories = {
                general: {
                    name: '🏠 General Commands',
                    description: 'Basic bot information and utility commands',
                    commands: [
                        {
                            name: '/introduction',
                            description: 'Get an introduction to the bot',
                            usage: '/introduction',
                            examples: ['/introduction']
                        },
                        {
                            name: '/ping',
                            description: 'Check bot latency and response time',
                            usage: '/ping',
                            examples: ['/ping']
                        },
                        {
                            name: '/help',
                            description: 'Display this help menu',
                            usage: '/help [category]',
                            examples: ['/help', '/help category:music']
                        }
                    ]
                },
                utility: {
                    name: '🛠️ Utility Commands',
                    description: 'Server and user information commands',
                    commands: [
                        {
                            name: '/userinfo',
                            description: 'Get detailed information about a user',
                            usage: '/userinfo [user]',
                            examples: ['/userinfo', '/userinfo user:@someone']
                        },
                        {
                            name: '/serverinfo',
                            description: 'Get detailed information about the server',
                            usage: '/serverinfo',
                            examples: ['/serverinfo']
                        },
                        {
                            name: '/invite',
                            description: 'Get the bot invite link',
                            usage: '/invite',
                            examples: ['/invite']
                        }
                    ]
                },
                music: {
                    name: '🎵 Music Commands',
                    description: 'Music playback and control commands',
                    commands: [
                        {
                            name: '/play-music',
                            description: 'Play music from YouTube (videos, playlists, and mixes supported)',
                            usage: '/play-music <url>',
                            examples: ['/play-music url:https://youtube.com/watch?v=...', '/play-music url:https://youtube.com/playlist?list=...']
                        },
                        {
                            name: '/play-status',
                            description: 'Display current Spotify or Apple Music track playing',
                            usage: '/play-status [user]',
                            examples: ['/play-status', '/play-status user:@someone']
                        }
                    ]
                },
                twitch: {
                    name: '📺 Twitch Commands',
                    description: 'Twitch stream monitoring and notifications',
                    commands: [
                        {
                            name: '/twitch add',
                            description: 'Add a Twitch streamer to monitor for live notifications',
                            usage: '/twitch add <username> [channel]',
                            examples: ['/twitch add username:ninja', '/twitch add username:ninja channel:#general'],
                            permissions: 'Manage Channels'
                        },
                        {
                            name: '/twitch remove',
                            description: 'Remove a streamer from monitoring',
                            usage: '/twitch remove <username>',
                            examples: ['/twitch remove username:ninja'],
                            permissions: 'Manage Channels'
                        },
                        {
                            name: '/twitch list',
                            description: 'Show all monitored streamers in this server',
                            usage: '/twitch list',
                            examples: ['/twitch list'],
                            permissions: 'Manage Channels'
                        },
                        {
                            name: '/twitch channel',
                            description: 'Set the notification channel for live alerts',
                            usage: '/twitch channel <channel>',
                            examples: ['/twitch channel channel:#live-streams'],
                            permissions: 'Manage Channels'
                        },
                        {
                            name: '/twitch check',
                            description: 'Manually check if a streamer is currently live',
                            usage: '/twitch check <username>',
                            examples: ['/twitch check username:ninja']
                        },
                        {
                            name: '/twitch stats',
                            description: 'View Twitch monitoring statistics',
                            usage: '/twitch stats',
                            examples: ['/twitch stats']
                        }
                    ]
                }
            };

            // If specific category requested, show only that category
            if (specificCategory && commandCategories[specificCategory]) {
                const category = commandCategories[specificCategory];
                const embed = createCategoryEmbed(category, 1, 1);
                return await interaction.reply({ embeds: [embed] });
            }

            // Create pagination for all categories
            const categories = Object.values(commandCategories);
            let currentPage = 0;

            const embed = createCategoryEmbed(categories[currentPage], currentPage + 1, categories.length);
            const row = createNavigationRow(currentPage, categories.length);

            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: false
            });

            // Create collector for pagination
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({
                        content: 'Only the command user can navigate the help menu!',
                        ephemeral: true
                    });
                }

                if (i.customId === 'help_previous') {
                    currentPage = currentPage > 0 ? currentPage - 1 : categories.length - 1;
                } else if (i.customId === 'help_next') {
                    currentPage = currentPage < categories.length - 1 ? currentPage + 1 : 0;
                } else if (i.customId === 'help_home') {
                    currentPage = 0;
                }

                const newEmbed = createCategoryEmbed(categories[currentPage], currentPage + 1, categories.length);
                const newRow = createNavigationRow(currentPage, categories.length);

                await i.update({
                    embeds: [newEmbed],
                    components: [newRow]
                });
            });

            collector.on('end', async () => {
                try {
                    const disabledRow = createNavigationRow(currentPage, categories.length, true);
                    await response.edit({ components: [disabledRow] });
                } catch (error) {
                    // Message might be deleted, ignore error
                }
            });

        } catch (error) {
            console.error('[HELP COMMAND] Error:', error);
            await interaction.reply({ embeds: [bug] });
            global.reportError(error, 'Help', 'Utility');
        }
    }
};

function createCategoryEmbed(category, currentPage, totalPages) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
            name: 'Chiyoko Haruka Help Menu',
            iconURL: 'https://i.imgur.com/mwOFCBO.png'
        })
        .setTitle(category.name)
        .setDescription(category.description)
        .setTimestamp()
        .setFooter({
            text: `${config.BOT_NAME} • Page ${currentPage}/${totalPages} • Use /help category:<name> for specific categories`,
            iconURL: 'https://i.imgur.com/mwOFCBO.png'
        });

    // Add commands to embed
    category.commands.forEach(cmd => {
        let fieldValue = `**Description:** ${cmd.description}\n**Usage:** \`${cmd.usage}\``;
        
        if (cmd.permissions) {
            fieldValue += `\n**Permissions:** ${cmd.permissions}`;
        }
        
        if (cmd.examples && cmd.examples.length > 0) {
            fieldValue += `\n**Examples:**\n${cmd.examples.map(ex => `• \`${ex}\``).join('\n')}`;
        }

        embed.addFields({
            name: cmd.name,
            value: fieldValue,
            inline: false
        });
    });

    // Add helpful tips
    if (currentPage === 1) { // General commands page
        embed.addFields({
            name: '💡 Tips',
            value: '• Use `/help category:<name>` to view specific command categories\n• Commands with `[optional]` parameters can be used without them\n• Commands with `<required>` parameters must include those options',
            inline: false
        });
    }

    return embed;
}

function createNavigationRow(currentPage, totalPages, disabled = false) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('help_previous')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId('help_home')
                .setLabel('🏠 Home')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled || currentPage === 0),
            new ButtonBuilder()
                .setCustomId('help_next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setLabel('Support Server')
                .setStyle(ButtonStyle.Link)
                .setURL(config.GITHUB_ISSUES || 'https://github.com/Harleythetech/Chiyoko-Haruka/issues')
                .setDisabled(disabled)
        );
}
