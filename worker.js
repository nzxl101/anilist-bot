process.env["NTBA_FIX_319"] = 1;
process.env["NTBA_FIX_350"] = 1;

const {parentPort, workerData} = require("worker_threads");
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(workerData.telegram.botToken);
const axios = require("axios");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

(async () => {
    const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 800, height: 375 }, args: ["--no-sandbox", "--single-process", "--no-zygote"]});
    let rateLimited = false, z = 0;

    if(workerData.entries.length >= 1) {
        workerData.entries.forEach(async (x, i) => {
            await new Promise(c => setTimeout(c, i*4000));

            if(rateLimited) {
                console.log(`[${workerData.id}] ${x.id} is currently rate limited.. Retrying in a minute`);
                await new Promise(r => setTimeout(r, 1*60*1000));
                rateLimited = false;
            }
            
            axios({
                method: "POST", 
                url: "https://graphql.anilist.co", 
                data: { 
                        "query": `mutation(${workerData.settings.FollowUser && x.following == false ? "$userId: Int, " : ""} $entryId: Int, $type: LikeableType) {
                                    ToggleLike: ToggleLikeV2(id: $entryId, type: $type) { ... on ListActivity { id isLiked }}
                                    ${workerData.settings.FollowUser && x.following == false ? "ToggleFollow (userId: $userId) { id name isFollowing }" : ""}
                                }`,
                        "variables": { userId: x.userId, entryId: x.id, type: "ACTIVITY" }},
                headers: workerData.headers
            }).then(async response => {
                if(!response.data) return console.log("No data received");

                if(workerData.settings.FollowUser && response.data.data.ToggleFollow.isFollowing == true && response.data.data.ToggleLike.isLiked == true || response.data.data.ToggleLike.isLiked == true) {
                    console.log(`[${workerData.id}] Liked ${workerData.settings.FollowUser && response.data.data.ToggleFollow.isFollowing == true ? "and followed " : ""}user activity from ${x.username}! [${x.media.title}]`);
                
                    if(workerData.settings.Notifications) {
                        let page = await browser.newPage();
                        await page.goto(`file://${path.join(__dirname, "screenshot.html")}?username=${x.username}&uid=${x.userId}&aid=${x.id}&avatar=${x.avatar}&cover=${x.media.image}&anime=${x.media.title}${workerData.settings.FollowUser && response.data.data.ToggleFollow.isFollowing == true ? "&follow" : ""}`);
                        await page.screenshot({ path: `./temp_${x.id}.png` });
                        await page.close();
    
                        bot.sendPhoto(workerData.telegram.userID, fs.readFileSync(`temp_${x.id}.png`), {}, { filename: `${x.id}`, contentType: "application/octet-stream" });
                        fs.unlinkSync(`temp_${x.id}.png`);
                    }
                }
            }).catch(err => {
                if(err.response) {
                    if(err.response.status == 429) {
                        console.log(`[${workerData.id}] Failed id ${x.id} because of Rate Limit`);
                        rateLimited = true;
                    }
                }
            }).finally(async () => {
                z++;
                parentPort.postMessage({ userId: x.userId, entryId: x.id, obj: x, done: rateLimited ? false : true });

                if(z == workerData.entries.length) await browser.close();
            });
        });
    }
})();