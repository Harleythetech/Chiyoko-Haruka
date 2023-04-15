const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memes')
    .setDescription('Get\'s the good stuff from r/Meme'),

  async execute(interaction) {
    console.log(`[LOG] r/meme has been executed`);
    try{
    const { default: got } = await import('got');
    const response = await got('https://reddit.com/r/meme/random.json');
    const content = JSON.parse(response.body);
    const permalink = content[0].data.children[0].data.permalink;
    const SGUrl = `https://reddit.com${permalink}`;
    const SGImage = content[0].data.children[0].data.url_overridden_by_dest;
    const SGTitle = content[0].data.children[0].data.title;
    const SGUpvotes = content[0].data.children[0].data.ups;
    const SGDownvotes = content[0].data.children[0].data.downs;
    const SGNumComments = content[0].data.children[0].data.num_comments;

    const sg = new EmbedBuilder()
      .setTitle(`r/Meme | ${SGTitle}`)
      .setURL(SGUrl)
      .setImage(SGImage)
      .setColor(0x0099ff)
      .setFooter({text: `👍 ${SGUpvotes} 👎 ${SGDownvotes} 💬 ${SGNumComments}`});

    return interaction.reply({ embeds: [sg] });}
    catch (error){
      console.error(error);
    }
  },
};
