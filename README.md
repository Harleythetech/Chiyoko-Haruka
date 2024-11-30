<p align="center"><img src="https://i.imgur.com/mwOFCBO.png" width="260" height="220"></p>

### <p align="center">Chiyoko Haruka - v2.r002s</p>
------------------------------------------------------
Chiyoko Haruka is a feature-packed Discord bot designed to provide a wide range of useful features and utilities to users. One of its unique features is the ILoveYou command, which is designed to reject user confessions in a lighthearted and humorous way.

In addition to this fun feature, Chiyoko Haruka also includes a Spotify Status Checker, which allows you to easily share your latest tracks with friends, and access to popular subreddits such as r/yandere, r/meme, r/wholesomememe, r/suddenlygay, and r/whataweeb.

The bot also provides a range of utilities, including info, invite, ping, serverinfo, and userinfo, which can help you manage your Discord server and stay organized.

Whether you're looking for a way to stay connected with the latest memes and trends, share your favorite music, or manage your server more effectively, Chiyoko Haruka has got you covered. With its fun and unique features and powerful utilities, this bot is a must-have for any Discord user.

# Get Started

The following things are required:
- [Node.js](https://nodejs.org/en)
- [VSCode](https://code.visualstudio.com/) or any editor you want
- [Discord Developer Portal](https://discord.com/developers/)

Now Let's get into the real deal, Go to [Discord Developer Portal](https://discord.com/developers/) and create a new application.

![image](https://user-images.githubusercontent.com/51787264/232237205-36f868bb-df87-4dda-94ee-99502595ac70.png)

once you created your application make sure to get the following things [Bot's Token, Application ID, and Invite Link] your can create your invite link in the OAuth panel> URL Generator

![image](https://user-images.githubusercontent.com/51787264/232237406-0ab32b23-810e-4fab-9078-fd2032f2e6cb.png)

make sure to select Bot as you are using the application for a "BOT". Next Select the permission you want to use, NEVER USE ADMINISTRATORR!

![image](https://user-images.githubusercontent.com/51787264/232237482-dc5f915f-fb93-44fc-8c7b-e25d03a13c21.png)

![image](https://user-images.githubusercontent.com/51787264/232237523-297c2848-fb60-453c-8865-4e00bcdee781.png)

My default choice are these since it doesn't join a call nor does it have any moderator tools. Okay, once everything is selected you should be able to see a link underneath that selections. Make sure to copy that link and paste it in the ```INVLINK``` That is found in ```./handlers/config.json/```.

**Moving Forward!**

Next step is to create a file called ```.env``` this is where we store our important keys (Bot's Token, Application ID, ChannelID, GuildID). Once created head over to your developer portal and create a bot.

![image](https://user-images.githubusercontent.com/51787264/232237797-1370b4aa-bbfd-49d1-a256-c4bb9b9cd57b.png)

just click on the "add bot" to then name it whatever you want below that you should be able to copy your ```Token```. Paste that token to your ENV file

sample code:
```
TOKEN=IOPAJDSFOAGDFOUGHNLBVILUH1235634OIUJDFG
APP_ID=1234537685697585
GUILD_ID=23145264578458613
CHANNEL_ID=234534637316345
```
For AppID you should be able to get that from ```General Information> ApplicationID``` from Discord Developer Portal

For Channel ID ```chid``` you'll be able to get that by enabling Developer Mode which is found in ```Discord App User Settings> Advanced> Developer Mode``` afterwards exit from settings and right click on a specific channel you wan't to use. Then press CopyID and that should copy your ```chid```

for GuildID ```guid``` right click on your server icon the one on the left side selector then click CopyID and that should copy your ```guid```

all of these are needed to be able to make the bot run.

**Final Steps**

You are almost at the end! all you need to do is run the ```npm install``` (one time command) command first to install all the necessary node_modules then run ```comdep.js``` (bot / command only works on selected GUILD) or ```comdepGlobal.js``` (Global Command) once you managed to run it just run index.js and your bot should start!

```
Command Fist Time Install (if newley downloaded)
npm install
node CommandPush.js
node index.js
```

--------------------------------------------------------------------------------
You Have Reached the end! Thank you for reading.
