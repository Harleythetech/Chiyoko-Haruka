const { EmbedBuilder, SlashCommandBuilder } = require ('discord.js');
const {maintenance} = require ('../../handlers/embed.js');
const ver = require (`../../handlers/config.json`);
module.exports ={
    data: new SlashCommandBuilder()
    .setName(`headpats`)
    .setDescription(`headpat the person you want to.`)
    .addUserOption(option =>
        option.setName(`user`)
        .setDescription(`Select the user to headpat`)),
    
    async execute (interaction){
        console.log(`[LOG] Headpats have been given.`);
        try{
            const user = interaction.options.getUser('user') || interaction.user;
            const api = await fetch ('https://some-random-api.com/animu/pat');
            const response = (await api.json());

            const link = response.link;
            const embed = new EmbedBuilder()
            .setTitle('Headpats!')
            .setDescription(`${interaction.user.tag} has given some to **${user.username}**! `)
            .setImage(link)
            .setTimestamp()
            .setFooter({text: `${ver.BOT_NAME}  ${ver.BOT_VERSION}`})
            .setColor(0x22e4cc);
            return interaction.reply({embeds: [embed]})
        }catch (error){
            console.log(`[ERROR] ${error}`)
            return interaction.reply({embeds: [maintenance]})
        }
            

        }
    }