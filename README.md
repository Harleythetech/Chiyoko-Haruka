# Chiyoko-Haruka
```
All in one Experimental Bot made from scratch with the help of discord.js
```

![image](https://user-images.githubusercontent.com/51787264/184538533-44c68204-6557-4e4a-a63d-61167769e0d1.png)

```
Version: v0.1.ch1r.canary
Language: JS[english]
Status: Unstable | EXPERIMENTAL [WIP]
```

# To get Started:
to get started you'll need the following things

Repository: https://github.com/Harleythetech/Chiyoko-Haruka

Discord.js Documentation: [discordjs.guide](https://discordjs.guide/#before-you-begin) (or) [discord.js.org](https://discord.js.org/) (or) [Discord Developer Documentation](https://discord.com/developers/docs/intro)

Discord Developer Portal: [Discord Developer Portal](https://discord.com/developers/applications)

Node JS: https://nodejs.org/en/download/

# Step 1: Making the bot Work
First Download the Repository obviously you'll need it. After that extract it with the extractor choice of yours .

![image](https://user-images.githubusercontent.com/51787264/184537334-1d4cac7f-e534-4bce-a869-d49d29fc1a98.png)

launch ```Install.bat``` this will install all the necessary node modules in order for it to work.

# Step 2: Dev Portal 
Now that everything is installed head over to ```Discord Developer Portal``` and create your new bot!
[Creating a Bot]

◙ Click on to `New Application` and then name your application

◙ Selct the application you will see bot just under `OAuth2` select that

◙ Press `Add Bot`

◙  Then go to `OAuth2` to get the bot's invite link

◙ Under scopes you'll see bot click that and under you see `Bot Permissions` select the permissions

◙ Copy the invite link which is generated on the `Scopes`

◙ Go to bot tab then you'll see `TOKEN` click copy 

◙ Make sure you turn on both the intends in your you'll find that in that bot category

And now you got the token

# Step 3: Powering the bot up!

◙ Edit the ```dot.env``` to ```.env``` since it will not work when ```dot``` is included in the file name, now that that's done Open up the Editor of your choice (preferably VSCode) and edit ```.env``` you should see something like this:

```
{
  TOKEN= ///Bot Token 
  INVLINK= ///OAuth2 Link
  chid= ///Channel ID for Logs
}
```

◙ After that go to ```/handlers/config.json``` and set all the variables needed for it to work:

```
{"PREFIX": "ch.",
"BOT_NAME": "Chiyoko Haruka",
"BOT_VERSION": "v0.1.ch1r.canary"
}
```

◙ If everything is done right the bot should power up by using the command ```node main.js``` [OR] F5 - Run | Start Debugging

# End
I'm Surprised you made it this far! if you like this simple project please help me grow this bot! your help means a lot to me.
