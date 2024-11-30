const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { toomuch, notlistening } = require('../../handlers/embed.js');

class PlayStatus {
    constructor(interaction) {
        this.interaction = interaction;
        this.user = interaction.options.getUser('user') || interaction.user;
        this.member = interaction.guild.members.cache.get(this.user.id);
        this.media = this.member.presence.activities.find(activity => activity.type === 2);
    }

    async convertTime(duration) {
        const { default: convert } = require('parse-ms');
        const timeConvert = convert(duration);
        const minutes = timeConvert.minutes < 10 ? `0${timeConvert.minutes}` : timeConvert.minutes;
        const seconds = timeConvert.seconds < 10 ? `0${timeConvert.seconds}` : timeConvert.seconds;
        return `${minutes}:${seconds}`;
    }

    async buildSpotifyEmbed() {
        const imageUrl = `https://i.scdn.co/image/${this.media.assets.largeImage.slice(8)}`;
        const trackUrl = `https://open.spotify.com/search/${encodeURIComponent(this.media.details)}%20${encodeURIComponent(this.media.state)}`;
        const duration = this.media.timestamps.end - this.media.timestamps.start;
        const timeConverted = await this.convertTime(duration);

        const embed = new EmbedBuilder()
            .setTitle('Currently Playing on Spotify')
            .setColor(0x01ED760)
            .setImage(imageUrl)
            .addFields(
                { name: 'Song', value: this.media.details },
                { name: 'Artist', value: this.media.state, inline: true },
                { name: 'Album', value: this.media.assets.largeText, inline: true },
                { name: 'Duration', value: timeConverted, inline: true }
            )
            .setFooter({ text: `Requested by ${this.interaction.user.tag}` })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setLabel('Play in Spotify')
            .setStyle(ButtonStyle.Link)
            .setURL(trackUrl);

        const row = new ActionRowBuilder().addComponents(button);

        return { embed, row };
    }

    async buildAppleMusicEmbed() {
        const filteredImage = this.media.assets.largeImage.split('/').slice(6, -1).join('/');
        const imageUrl = `https://is1-ssl.mzstatic.com/image/thumb/${filteredImage}/100000x100000-999.jpg`;
        const duration = this.media.timestamps.end - this.media.timestamps.start;
        const timeConverted = await this.convertTime(duration);

        const embed = new EmbedBuilder()
            .setTitle('Currently Playing on Apple Music')
            .setColor(0xff0000)
            .setImage(imageUrl)
            .addFields(
                { name: 'Song', value: this.media.details },
                { name: 'Artist / Album', value: this.media.state, inline: true },
                { name: 'Duration', value: timeConverted, inline: true }
            )
            .setFooter({ text: `Requested by ${this.interaction.user.tag}` })
            .setTimestamp();

        return { embed };
    }

    async execute() {
        if (!this.media) {
            return this.interaction.reply({ embeds: [notlistening] });
        }

        try {
            if (this.media.name === 'Spotify') {
                const { embed, row } = await this.buildSpotifyEmbed();
                return this.interaction.reply({
                    embeds: [embed],
                    components: [row],
                });
            } else if (this.media.name === 'Apple Music') {
                const { embed } = await this.buildAppleMusicEmbed();
                return this.interaction.reply({ embeds: [embed] });
            } else {
                return this.interaction.reply({ embeds: [notlistening] });
            }
        } catch (error) {
            console.error(`[ERROR - PLAYSTATUS] ${error}`);
            return this.interaction.reply({ embeds: [toomuch] });
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play-status')
        .setDescription('Displays your current track playing (only supports Spotify and Apple Music)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check what the user is listening to')
                .setRequired(false)
        ),
    async execute(interaction) {
        const playStatus = new PlayStatus(interaction);
        await playStatus.execute();
    }
};
