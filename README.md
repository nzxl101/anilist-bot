# AniList.co Mass-Like/Follow User Bot
Disclaimer: Don't use this bot, if you want to keep the ability to like/follow/comment posts.
This will get you 99.8% banned if you don't adjust the default settings.

I'm only releasing this because I had enough fun coding and researching how to abuse GraphQL.
If a moderator or admin of AniList sees this, please don't ban me entirely from the site.
![Warning](https://i.imgur.com/zeaYyHs.png)

# How To Use
First of all you need to create credentials on [this](https://anilist.co/settings/developer) site.
After that you need to create a [Telegram bot](https://sendpulse.com/knowledge-base/chatbot/create-telegram-chatbot) account. Yes, this is needed to configure the bot and use it properly.
You should also get your [Telegram user id](https://www.youtube.com/watch?v=W8ifn3ATpdA) so that the bot can message you and only you.
```bash
git clone https://github.com/nzxl101/anilist-bot
cd anilist-bot && npm i
node index.js
```
Follow the first time setup and restart the app.
You can access the bot by sending a "/hey" command on Telegram.

# Recommended Settings
Like oldest first: On
Max Pages: 10
Max Items: 10
Cooldown: 20