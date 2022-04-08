# anilist.co activity bot
with this bot you can automatically like activities and follow users
why? because why not lmao.

# how to use
1. `git clone https://github.com/nzxl101/anilist-bot`
2. `cd anilist-bot && npm i`
3. create config.json and fill in your stuff
```
{
    "Credentials": {
        "clientID": "",
        "clientSecret": "",
        "redirectURI": "https://anilist.co/api/v2/oauth/pin",
        "accessToken": ""
    },
    "List": [
        {
            "id": 665195,
            "type": 1,
            "name": "Schwimmii"
        },
        {
            "id": 132405,
            "type": 0,
            "name": "My Dress-Up Darling"
        }
    ],
    "Options": {
        "FollowUser": false,
        "LikeActivity": true
    }
}
```
4. `node index.js`

# how to add entries to list
```
    {
        "id": 132405, # id of the title
        "type": 0, # 0 = anime/manga, 1 = user
        "name": "My Dress-Up Darling" # this is only used for log
    }
```

# how to get credentials
https://anilist.gitbook.io/anilist-apiv2-docs/overview/oauth/authorization-code-grant