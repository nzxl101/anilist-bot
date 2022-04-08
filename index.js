const config = require("./config.json");
const Helper = require("./helper.js");
const helper = new Helper();

(async () => {
    console.log(`Starting up anilist.co bot..`);
    if(!config.Credentials.Telegram.botToken) {
        return console.log("Missing Telegram bot token");
    }
    if(!config.Credentials.Telegram.userID) {
        return console.log("Missing userID for Telegram bot");
    }

    helper.startTelegram(config.Credentials.Telegram.botToken, config.Credentials.Telegram.userID);

    // http.createServer((req, res) => {
    //     res.writeHead(200);
    //     res.end();
    // }).listen(process.env.PORT || 80);



    // if(!config.Credentials.accessToken) {
    //     rl.question('Please authorize using this link and paste the code: https://anilist.co/api/v2/oauth/authorize?client_id=${config.Credentials.clientID}&redirect_uri=${config.Credentials.redirectURI}&response_type=code\n>', async (code) => {
    //         config.Credentials.accessToken = await helper.getAccessToken(code);
    //         fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
    //         console.log("Ok! Restart the app now");
    //     });
    // } else {
    //     token = await helper.authorizeToken();
    //     if(config.Credentials.telegram && config.Credentials.telegramUser && token) {
    //         console.log("Ready!");
    //         helper.startTelegram();
    //     } else {
    //         console.log("Failed to start.. check config or refresh access_token");
    //     }
    // }
})();