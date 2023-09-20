const { EmbedBuilder, SlashCommandBuilder } = require ('discord.js');
const {maintenance} = require ('../../handlers/embed.js');
const ver = require (`../../handlers/config.json`);
module.exports ={
    data: new SlashCommandBuilder()
    .setName(`hug`)
    .setDescription(`hug the person you want to.`)
    .addUserOption(option =>
        option.setName(`user`)
        .setDescription(`Select the user to hug`)),
    
    async execute (interaction){
        console.log(`[LOG] hugs have been given.`);
        try{
            const user = interaction.options.getUser('user') || interaction.user;
            const api = await fetch ('https://some-random-api.com/animu/hug');
            const response = (await api.json());

            const link = response.link;
            const embed = new EmbedBuilder()
            .setTitle('Giving some Huggies!!')
            .setDescription(`${interaction.user.tag} hugged **${user.username}**! `)
            .setImage(link)
            .setTimestamp()
            .setColor(0x22e4cc)
            .setFooter({text: `${ver.BOT_NAME}  ${ver.BOT_VERSION}`});
            return interaction.reply({embeds: [embed]})
        }catch (error){
            console.log(`[ERROR] ${error}`)
            return interaction.reply({embeds: [maintenance]})
        }
            

        }
    }