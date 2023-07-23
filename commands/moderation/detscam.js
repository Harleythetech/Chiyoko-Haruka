const { EmbedBuilder, SlashCommandBuilder,ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require(`../../handlers/config.json`);

const sdp = require("stop-discord-phishing");

module.exports = {
    data: new SlashCommandBuilder()
    .setName(`check-link`)
    .setDescription(`Checks Link for scams`)
    .addStringOption(option =>
        option.setName('link')
          .setDescription('link the user want to scan')
          .setRequired(true)
      ),

    async execute(interaction) {

        // Get the link from the interaction
        const link = interaction.options.get('link');


        // Get the report for the link
        const Grab = await sdp.checkMessage(link.value,true);
        console.log(Grab);

        // If the link is a scam, create an embed and send it to the user
        if (Grab == true) {
            const embed = new EmbedBuilder()
                .setTitle('Danger: Scam Link Detected')
                .setDescription(`${link.value} is marked as a phising link, good thing you scanned it before opening!`)
                .setColor(0xff0000)
                .setImage('https://media.tenor.com/ayZKpLp26ZkAAAAd/this-is-dangerous.gif')

                await interaction.reply({embeds: [embed]})
        } else if(Grab == false) {
            // If the link is not a scam, send a message to the user
            const embed = new EmbedBuilder()
            .setTitle('Safe: Happy Browsing!')
            .setDescription('Link is safe to open, Still be careful on opening the link you scanned as I may flag it as safe because it\'s not in my database yet')
            .setImage('https://gifdb.com/images/high/anime-girl-okay-sign-b5zlye5h8mnjhdg2.gif')
            const btn = new ButtonBuilder()
            .setLabel('Open Link')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://${link.value}`);
            
            const row = new ActionRowBuilder()
            .addComponents(btn)

            return interaction.reply({
                embeds: [embed],
                components: [row]

            });
        }

    },
};