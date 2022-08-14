const got = require('got');
const Discord = require('discord.js');

module.exports = {
    name: "yandere",
    category: "Image",
    description: "Sends a random photo from r/suddenlygay",

    run: async (client, message, args) => {
        const embed = new Discord.MessageEmbed()
        got('https://reddit.com/r/yandere/random.json').then(response => {
            let content = JSON.parse(response.body);
            let permalink = content[0].data.children[0].data.permalink;
            let yanUrl = `https://reddit.com${permalink}`;
            let yanImage = content[0].data.children[0].data.url;
            let yanitle = content[0].data.children[0].data.title;
            let yanUpvotes = content[0].data.children[0].data.ups;
            let yanDownvotes = content[0].data.children[0].data.downs;
            let yanNumComments = content[0].data.children[0].data.num_comments;
            embed.setTitle(`${yanitle}`)
            embed.setDescription(`r/Yandere`)
            embed.setURL(`${yanUrl}`)
            embed.setImage(yanImage)
            embed.setColor('RANDOM')
            embed.setFooter(`👍 ${yanUpvotes} 👎 ${yanDownvotes} 💬 ${yanNumComments}`)
            message.channel.send(embed);
        })

}    }