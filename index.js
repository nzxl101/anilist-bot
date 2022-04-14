const fs = require("fs");
const axios = require("axios");
const http = require("http");
const url = require("url");
const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
let config = {};

(async () => {
    console.log(`Starting up anilist.co bot..`);

    if(!fs.existsSync("./config.json")) {
        console.log("Executing first time setup..");

        config = {
            Credentials: {
                AniList: {
                    clientID: "",
                    clientSecret: "",
                    accessToken: null,
                    redirectURI: `http://localhost:8081`
                },
                Telegram: {
                    botToken: "",
                    userID: ""
                }
            },
            Settings: {
                FollowUser: false,
                OldestFirst: false,
                Pages: 5,
                MaxItems: 25,
                Cooldown: 5,
                Notifications: true
            },
            List: []
        };

        rl.question("First of all we need the AniList credentials. (FORMAT>> id.secret)\n>", async (creds) => {
            creds = creds.split(".");
            if(!creds[0] || !creds[1]) return;

            config.Credentials.AniList.clientID = creds[0];
            config.Credentials.AniList.clientSecret = creds[1];

            console.log(`Well, let's check if the credentials are working indeed..\nHead over to this and authorize > https://anilist.co/api/v2/oauth/authorize?client_id=${config.Credentials.AniList.clientID}&redirect_uri=${config.Credentials.AniList.redirectURI}&response_type=code`);
            
            http.createServer((req, res) => {
                let queryObject = url.parse(req.url, true).query;
                if(queryObject.code) {
                    res.writeHead(200);
                    res.end("<script>window.close();</script>");
                    
                    let code = queryObject.code;
                    axios({
                        method: "POST", 
                        url: "https://anilist.co/api/v2/oauth/token",
                        data: {
                            "grant_type": "authorization_code",
                            "client_id": config.Credentials.AniList.clientID,
                            "client_secret": config.Credentials.AniList.clientSecret,
                            "redirect_uri": config.Credentials.AniList.redirectURI,
                            "code": code
                        },
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        }
                    }).then(response => {
                        config.Credentials.AniList.accessToken = response.data.access_token;
                        console.log("AniList credentials are working!\nNow we need the telegram credentials, so that you can configure and start/stop the bot.");
                        rl.question("FORMAT>> BotToken.userID\n>", async (telcreds) => {
                            telcreds = telcreds.split(".");
                            if(!telcreds[0] || !telcreds[1]) return;
            
                            config.Credentials.Telegram.botToken = telcreds[0];
                            config.Credentials.Telegram.userID = telcreds[1];
            
                            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                            console.log("You should be good to go now. Go ahead and restart the bot!");
            
                            process.exit(0);
                        });
                    });
                }
            }).listen(8081);
        });
    } else {
        config = require("./config.json");
        
        let Helper = require("./helper.js"), helper = new Helper();
        if(config.Credentials.Telegram.botToken && config.Credentials.Telegram.userID) 
            helper.startTelegram(config.Credentials.Telegram.botToken, config.Credentials.Telegram.userID);
    }
})();