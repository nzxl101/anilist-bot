process.env["NTBA_FIX_319"] = 1;
process.env["NTBA_FIX_350"] = 1;

const config = require("./config.json");
const TelegramBot = require('node-telegram-bot-api');
const axios = require("axios");
const { Worker } = require("worker_threads");
const fs = require("fs");
const moment = require("moment");

const headers = { "Authorization": `Bearer ${config.Credentials.AniList.accessToken}`, "Content-Type": "application/json", "Accept": "application/json" };
var bot = null, messageCallback = {};
let worker = {}, rateLimited = false, _obj = [], running = null, messageID = "";
let done = [], failed = [];

module.exports = class Helper {
    search(text, type, bool = false, _tmp = []) {
        return new Promise(async resolve => {
            axios({ 
                method: "POST", 
                url: "https://graphql.anilist.co", 
                data: { 
                    "query": `query ($search: ${Number(text) ? "Int" : "String"} ${!Number(text) && type !== 1 ? ", $isAdult:Boolean" : ""}) {
                        ${!Number(text) && type == 0 ? "found: Page(perPage:2) { media(type: ANIME, isAdult: $isAdult, search: $search) { id title { userPreferred } } }" : Number(text) && type == 0 ? "found: Media(id: $search, type: ANIME) { id title { userPreferred } }" : ""}
                        ${!Number(text) && type == 1 ? "found: Page(perPage:3) { users(search: $search) { id name } }" : Number(text) && type == 1 ? "found: User(id: $search) { id name }" : ""}
                        ${!Number(text) && type == 2 ? "found: Page(perPage:2) { media(type: MANGA, isAdult: $isAdult, search: $search) { id title { userPreferred } } }" : Number(text) && type == 2 ? "found: Media(id: $search, type: MANGA) { id title { userPreferred } }" : ""}
                    }`,
                    "variables": { search: text }
                }, 
                headers: headers
            })
            .then(response => {
                if(response.data.data.found.media) {
                    response.data.data.found.media.forEach(x => _tmp.push([{ text: `${type == 0 ? "🎬 |" : "📖 |"} ${x.title.userPreferred}`, callback_data: JSON.stringify({ action: "add", value: { id: x.id, type: type } })}, { text: "🔗", url: `https://anilist.co/${type == 0 ? "anime" : "manga"}/${x.id}` }]));
                } else if(response.data.data.found.users) {
                    response.data.data.found.users.forEach(x => _tmp.push([{ text: `👤 | ${x.name}`, callback_data: JSON.stringify({ action: "add", value: { id: x.id, type: type } })}, { text: "🔗", url: `https://anilist.co/user/${x.id}` }]));
                } else {
                    console.log(response.data.data.found);
                    _tmp.push([{ text: `${type == 0 ? "🎬 |" : "📖 |"} ${response.data.data.found.title ? response.data.data.found.title.userPreferred : response.data.data.found.name}`, callback_data: JSON.stringify({ action: "add", value: { id: response.data.data.found.id, type: type } })}, { text: "🔗", url: `https://anilist.co/${type == 0 ? "anime" : type == 1 ? "user" : "manga"}/${response.data.data.found.id}` }]);
                }
                resolve(!bool ? _tmp : response.data.data.found.id && response.data.data.found.title ? { id: response.data.data.found.id, title: response.data.data.found.title, type: type } : { id: response.data.data.found.id, name: response.data.data.found.name, type: type });
            }).catch(e => {
                resolve([]);
            });
        });
    }

    getActivities(ids) {
        return new Promise(async resolve => {
            if(rateLimited) {
                await new Promise(r => setTimeout(r, 1*60*1000));
                rateLimited = false;
            }

            for(const id of ids) {
                await axios({
                    method: "POST", 
                    url: "https://graphql.anilist.co", 
                    data: { 
                        "query": `query($id: Int, $page: Int) { 
                                    Page(page: $page, perPage: ${Math.floor(config.Settings.MaxItems/ids.length)}) {
                                        pageInfo {
                                            currentPage perPage
                                        } 
                                        activities(${id.type == 0 ? `mediaId: $id, sort: ID_DESC, type: MEDIA_LIST` : `userId: $id, sort: ID_DESC`}) {
                                            ... on ListActivity { 
                                                id userId type status progress isLiked createdAt 
                                                user { 
                                                    id name avatar { large } isFollowing 
                                                } 
                                                media { 
                                                    id type bannerImage title { userPreferred } coverImage { large } }
                                                }
                                            }
                                        }
                                    }`, 
                        "variables": { id: id.id, page: (!id.cursor ? config.Settings.OldestFirst ? id.cursor = config.Settings.Pages : id.cursor = 1 : id.cursor) }
                    },
                    headers: headers
                }).then(response => {
                    if(!response.data) return console.log("No data received");

                    response.data.data.Page.activities.forEach(x => {
                        if(done.includes(x.id) || _obj.filter(y => y.id == x.id || y.userId == x.id).length > 0) return;
                        if((Math.floor(Date.now() / 1000) - x.createdAt) > 168*60*60) return config.Settings.OldestFirst ? id.cursor = 1 : id.cursor = config.Settings.Pages;
                        _obj.push({ username: x.user.name, avatar: x.user.avatar.large, userId: x.user.id, id: x.id, liked: x.isLiked, following: x.user.isFollowing, media: { title: x.media.title.userPreferred, image: x.media.coverImage.large } });
                    });

                    if(config.Settings.OldestFirst ? id.cursor <= 1 : id.cursor >= config.Settings.Pages) config.Settings.OldestFirst ? id.cursor = config.Settings.Pages : id.cursor = 1;
                    config.Settings.OldestFirst ? id.cursor-- : id.cursor++;
                }).catch(err => {
                    if(err.response) {
                        if(err.response.status == 429) {
                            rateLimited = true;
                        }
                    }
                });
            }

            _obj = _obj.filter(x => config.Settings.FollowUser ? x.following == false && x.liked == false : config.Settings.FollowUser ? x.following == true && x.liked == false : x.liked == false);
            resolve();
        });
    }

    start() {
        console.log("Checking for activities..");

        fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));

        this.getActivities(config.List).then(() => {
            this.spawn(5);
            running = setTimeout(() => this.start(), config.Settings.Cooldown*60*1000);
        });
    }

    async spawn(chunks = 5, added = 0) {
        if(_obj.length >= 1) {
            let promises = [];
            for(var i = chunks; i > 0; i--) {
                promises.push(i);
            }

            var task = (i) => new Promise((resolve) => {
                let id = (Math.random()+1).toString(36).substring(5), activityList = _obj.splice(0, Math.ceil((config.Settings.MaxItems-added) / i));
                added += activityList.length;
                if(activityList.length >= 1) {
                    console.log(`Spawning new worker thread [${id}] for ${activityList.length} activities`);
                    worker[id] = new Worker("./worker.js", { workerData: { id: id, entries: activityList, settings: config.Settings, telegram: config.Credentials.Telegram, headers: headers } });
                    worker[id].on("message", (r) => {
                        if(r.done) {
                            done.push(r.entryId);
                        } else {
                            _obj.push({ username: r.obj.username, avatar: r.obj.avatar, userId: r.obj.userId, id: r.obj.id, liked: r.obj.liked, following: r.obj.following, media: { title: r.obj.media.title, image: r.obj.media.image } });
                        }
                    });
                    worker[id].on("exit", (d) => { 
                        if(d == 0) {
                            console.log(`Worker [${id}] fulfilled tasks successfully`);
                            worker[id].terminate();
                            delete worker[id];
                            resolve();
                        }
                    });
                }
            });

            var sequence = (promise, i) => {
                return new Promise((resolve) => { resolve(promise.then(_ => task(i))); });
            }

            promises.reduce(sequence, Promise.resolve());
        }
    }

    askForInput(x = false, resolved = false) {
        return new Promise(resolve => {
            bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: "Please enter a value (8s 🏃‍♂️)", callback_data: JSON.stringify({ action: "none" })}]] }, { chat_id: config.Credentials.Telegram.userID, message_id: messageID }).then(() => {
                setTimeout(() => {
                    if(!x && !resolved) return resolve();
                    if(x && !resolved) return bot.emit("callback_query", JSON.stringify({ data: { action: "return", value: "settings" }}));
                }, 8*1000);
                messageCallback[config.Credentials.Telegram.userID] = (a) => {
                    resolved = true;
                    resolve(a.text);
                }
            });
        });
    }

    startTelegram() {
        bot = new TelegramBot(config.Credentials.Telegram.botToken, { polling: false });
        bot.startPolling().then(result => {
            if(result) {
                console.log("Telegram bot failed to start. Please check your credentials");
                return process.exit();
            }

            console.log("Telegram bot is ready!");

            bot.on("message", (message) => {
                let callback = messageCallback[message.chat.id];
                if (callback) {
                    console.log(`Received new message from ${config.Credentials.Telegram.userID}`);
                    delete messageCallback[message.chat.id];
                    return callback(message);
                }
            });

            bot.onText(/\/start/, (msg) => {
                if(msg.chat.id == config.Credentials.Telegram.userID) {
                    console.log(`Received new message from ${config.Credentials.Telegram.userID}`);
                    bot.deleteMessage(msg.from.id, messageID).catch(r => r).then(() => {
                        bot.sendMessage(msg.from.id, "Loading").then(r => {
                            messageID = r.message_id;
                            bot.editMessageText(`Anilist.co Bot | user: ${config.Credentials.Telegram.userID}`, { chat_id: config.Credentials.Telegram.userID, message_id: messageID });
                            setTimeout(() => bot.emit("callback_query", JSON.stringify({ data: { action: "return", value: "main" }})), 500);
                        });
                    });
                }
            });

            bot.on("polling_error", console.log);

            bot.on("callback_query", async (callbackQuery) => {
                let rnd = Math.random().toString(36).slice(6);
                if(!messageID) messageID = callbackQuery.message.message_id;
                if(!callbackQuery.data) callbackQuery = JSON.parse(callbackQuery);
                else callbackQuery.data = JSON.parse(callbackQuery.data);

                var sendMain = () => bot.editMessageReplyMarkup({ inline_keyboard: [
                        [{ text: running ? "Shutdown 🔴" : "Startup 🟢", callback_data: JSON.stringify({ action: "toggle" })}, { text: "Kill 💀", callback_data: JSON.stringify({ action: "kill" })}], 
                        [{ text: `Queued likes: ${_obj.filter(x => x.liked == false).length}${config.Settings.FollowUser ? "\n| Queued users: "+_obj.filter(x => x.following == false).length : ""}`, callback_data: JSON.stringify({ action: "none" })}],
                        [{ text: "Edit Settings 🔧", callback_data: JSON.stringify({ action: "settings" })}],
                        [{ text: `${moment(Date.now()).format("HH:MM:ss")} - ${rnd}`, callback_data: JSON.stringify({ action: "none" })}]
                    ]}, { chat_id: config.Credentials.Telegram.userID, message_id: messageID });

                var sendSettings = () => bot.editMessageReplyMarkup({ inline_keyboard: [
                        [{ text: "Follow Users "+(config.Settings.FollowUser ? "🟢" : "🔴"), callback_data: JSON.stringify({ action: "edit", value: "toggleFollow" })}, { text: "Like oldest first "+(config.Settings.OldestFirst ? "🟢" : "🔴"), callback_data: JSON.stringify({ action: "edit", value: "toggleOldest" })}, { text: "Notifications "+(config.Settings.Notifications ? "🟢" : "🔴"), callback_data: JSON.stringify({ action: "edit", value: "toggleNotis" })}],
                        [{ text: "Max pages to fetch: "+config.Settings.Pages, callback_data: JSON.stringify({ action: "edit", value: "changePages" })}],
                        [{ text: "Max items to like at once: "+config.Settings.MaxItems, callback_data: JSON.stringify({ action: "edit", value: "changeMaxItems" })}],
                        [{ text: "Cooldown: "+config.Settings.Cooldown, callback_data: JSON.stringify({ action: "edit", value: "changeCD" })}],
                        [{ text: "Add entries", callback_data: JSON.stringify({ action: "edit", value: "addEntry" })}],
                        [{ text: "Remove entries", callback_data: JSON.stringify({ action: "edit", value: "removeEntry" })}],
                        [{ text: "« Go back", callback_data: JSON.stringify({ action: "return", value: "main" })}],
                        [{ text: `${moment(Date.now()).format("HH:MM:ss")} - ${rnd}`, callback_data: JSON.stringify({ action: "none" })}]
                    ]}, { chat_id: config.Credentials.Telegram.userID, message_id: messageID });

                var saveConfig = () => {
                    bot.emit("callback_query", JSON.stringify({ data: { action: "return", value: "settings" }}));
                    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                };

                if(callbackQuery && callbackQuery.data.action) {
                    let action = callbackQuery.data.action;
                    if(action == "return") {
                        if(callbackQuery.data.value == "main") sendMain();
                        else if(callbackQuery.data.value == "settings") sendSettings();
                        return;
                    }

                    if(action == "deleteEntry") {
                        let entryToDelete = callbackQuery.data.value;
                        config.List.splice(config.List.findIndex(x => x.id == entryToDelete), 1);
                        saveConfig();
                        console.log(`Deleted entry ${entryToDelete}`);
                        return;
                    }

                    if(action == "add") {
                        let toAddToConfig = callbackQuery.data.value;
                        await this.search(toAddToConfig.id, toAddToConfig.type, true).then((x) => {
                            if(config.List.filter(entry => entry.id === toAddToConfig.id).length > 0) return bot.emit("callback_query", JSON.stringify({ data: { action: "return", value: "settings" }}));
                            config.List.push({ "id": x.id, "type": x.type, "name": x.name ? x.name : x.title.userPreferred });
                            saveConfig();
                            console.log(`Added entry ${x.id}`);
                        });
                        return;
                    }
    
                    if(action == "edit") {
                        let toChange = callbackQuery.data.value;
                        switch (toChange) {
                            case "toggleFollow":
                                config.Settings.FollowUser = !config.Settings.FollowUser;
                                console.log(`FollowUser: ${config.Settings.FollowUser ? "true" : "false"}`);
                                break;
                            case "toggleOldest":
                                config.Settings.OldestFirst = !config.Settings.OldestFirst;
                                console.log(`OldestFirst: ${config.Settings.OldestFirst ? "true" : "false"}`);
                                break;
                            case "toggleNotis":
                                config.Settings.Notifications = !config.Settings.Notifications;
                                console.log(`Notifications: ${config.Settings.Notifications ? "true" : "false"}`);
                                break;
                            case "changePages":
                                let pages = await this.askForInput();
                                if(pages && Number(pages)) {
                                    if(pages < 1 || pages >= 11) break;
                                    config.Settings["Pages"] = Number(pages);
                                    console.log(`Pages: ${config.Settings["Pages"]}`);
                                }
                                break;
                            case "changeMaxItems":
                                let maxItems = await this.askForInput();
                                if(maxItems && Number(maxItems)) {
                                    if(maxItems < 1 || maxItems >= 51) break;
                                    config.Settings["MaxItems"] = Number(maxItems);
                                    console.log(`MaxItems: ${config.Settings["MaxItems"]}`);
                                }
                                break;
                            case "changeCD":
                                let cooldown = await this.askForInput();
                                if(cooldown && Number(cooldown)) {
                                    if(cooldown < 3 || cooldown >= 21) break;
                                    config.Settings["Cooldown"] = Number(cooldown);
                                    console.log(`Cooldown: ${config.Settings["Cooldown"]}`);
                                }
                                break;
                            case "addEntry":
                                let text = await this.askForInput(true);
                                if(text && text.match(/^[a-zA-Z0-9_ ]{2,50}/)) {
                                    let list = [];
                                    list = list.concat(await this.search(text, 0), await this.search(text, 2), await this.search(text, 1));
                                    list.push([{ text: "« Go back", callback_data: JSON.stringify({ action: "return", value: "settings" })}]);
                                    bot.editMessageReplyMarkup({ inline_keyboard: list }, { chat_id: config.Credentials.Telegram.userID, message_id: messageID });
                                }
                                break;
                            case "removeEntry":
                                let _tmp = [];
                                config.List.forEach(x => _tmp.push([{ text: `${x.type == 0 ? "🎬 | " : x.type == 1 ? "👤 | " : x.type ? "📖 | " : ""} ${x.name}`, callback_data: JSON.stringify({ action: "none" })}, { text: `❌`, callback_data: JSON.stringify({ action: "deleteEntry", value: x.id })}]));
                                _tmp.push([{ text: "« Go back", callback_data: JSON.stringify({ action: "return", value: "settings" })}]);
                                bot.editMessageReplyMarkup({ inline_keyboard: _tmp }, { chat_id: config.Credentials.Telegram.userID, message_id: messageID });
                                break;
                        }
                        
                        if(toChange != "addEntry" && toChange != "removeEntry") {
                            saveConfig();
                            console.log("Config saved");
                        }
                        
                        return;
                    }
    
                    switch (action) {
                        case "toggle":
                            if(running) {
                                console.log("Stopping bot..");
                                for(const entry in config.List) {
                                    delete config.List[entry].cursor;
                                }

                                for (const [workerId, process] of Object.entries(worker)) {
                                    process.terminate();
                                    console.log(`Worker [${workerId}] terminated`);
                                }

                                clearTimeout(running);
                                running = null, worker = {}, _obj = [];
                                setTimeout(() => bot.emit("callback_query", JSON.stringify({ data: { action: "return", value: "main" }})), 1500);
                            } else {
                                console.log("Starting bot..");
                                this.start();
                                setTimeout(() => bot.emit("callback_query", JSON.stringify({ data: { action: "return", value: "main" }})), 1500);
                            }
                            break;
                        case "kill":
                            console.log("Killing bot..");
                            for(const entry in config.List) {
                                delete config.List[entry].cursor;
                            }

                            bot.editMessageText("Bot has been killed.", { chat_id: config.Credentials.Telegram.userID, message_id: messageID }).then(() => process.exit());
                            break;
                        case "settings":
                            sendSettings();
                            break;
                    }
                }
            });
        });
    }
}



