const got = require('got');
const Discord = require('discord.js');

module.exports = {
    name: "suddenlygay",
    category: "Image",
    description: "Sends a random photo from r/suddenlygay",

    run: async (client, message, args) => {
        const embed = new Discord.MessageEmbed()
        got('https://reddit.com/r/SuddenlyGay/random.json').then(response => {
            let content = JSON.parse(response.body);
            let permalink = content[0].data.children[0].data.permalink;
            let SGUrl = `https://reddit.com${permalink}`;
            let SGImage = content[0].data.children[0].data.url;
            let SGTitle = content[0].data.children[0].data.title;
            let SGUpvotes = content[0].data.children[0].data.ups;
            let SGDownvotes = content[0].data.children[0].data.downs;
            let SGNumComments = content[0].data.children[0].data.num_comments;
            embed.setTitle(`${SGTitle}`)
            embed.setDescription(`r/Suddenly Gay`)
            embed.setURL(`${SGUrl}`)
            embed.setImage(SGImage)
            embed.setColor('RANDOM')
            embed.setFooter(`👍 ${SGUpvotes} 👎 ${SGDownvotes} 💬 ${SGNumComments}`)
            message.channel.send(embed);
        })

}    }