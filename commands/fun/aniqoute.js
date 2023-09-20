const { EmbedBuilder, SlashCommandBuilder } = require ('discord.js');
const {maintenance} = require ('../../handlers/embed.js');
const ver = require (`../../handlers/config.json`);
module.exports ={
    data: new SlashCommandBuilder()
    .setName(`aniqoute`)
    .setDescription(`qoutes from anime`),
    
    async execute (interaction){
        console.log(`[LOG] aniqoute have been triggered.`);
        try{
            const api = await fetch ('https://some-random-api.com/animu/quote');
            const response = (await api.json());

            const qoute = response.sentence;
            const character = response.character;
            const anime = response.anime;

            const embed = new EmbedBuilder()
            .setTitle('AniQoute')
            .setDescription(` ${qoute} `)
            .addFields(
                {name: 'Character', value: character, inline:true},
                {name: 'Anime', value: anime, inline:true}
            )
            .setFooter({text: `${ver.BOT_NAME}  ${ver.BOT_VERSION}`})
            .setTimestamp()
            .setColor(0x22e4cc);
            return interaction.reply({embeds: [embed]})
        }catch (error){
            console.log(`[ERROR] ${error}`)
            return interaction.reply({embeds: [maintenance]})
        }
            

        }
    }