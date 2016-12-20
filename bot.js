const fs = require("fs"),
    Steam = require("steam"),
    csgo = require("csgo"),
    crypto = require("crypto");

class Bot {
    constructor() {
        this.steamClient = new Steam.SteamClient();
        this.steamUser = new Steam.SteamUser(this.steamClient);
        this.steamGC = new Steam.SteamGameCoordinator(this.steamClient, 730);
        this.csgoClient = new csgo.CSGOClient(this.steamUser, this.steamGC, false);

        this.csgoClient.on("itemData", (itemData) => {
            console.log(itemData);
        });

        this.steamUser.on("updateMachineAuth", (sentry, callback) => {
            fs.writeFile(this.sentryPath, sentry.bytes);

            let sha_file = crypto.createHash("sha1").update(sentry.bytes).digest();

            callback({ sha_file: sha_file });
        });
    }

    logIn(username, password, auth) {
        this.sentryPath = `sentry/${username}.sentry`;

        let loginData = {
            account_name: username,
            password: password,
            auth_code: auth
        };

        fs.readFile(this.sentryPath, (err, data) => {
            if (data) {
                loginData.sha_sentryfile = crypto.createHash("sha1").update(data).digest();
            }

            // trigger the whole sequence
            console.log("About to connect")
            this.steamClient.connect();
        });

        // set up event listeners
        this.steamClient.once("connected", () => {
            console.log("Connected")
            this.steamUser.logOn(loginData);
        });

        this.steamClient.once("logOnResponse", (response) => {
            if (response.eresult = Steam.EResult.OK) {
                console.log("Log on OK")
                this.csgoClient.launch();
            }
        });
    }

    sendFloatRequest(data) {
        return new Promise((resolve, reject) => {
            console.log(data.s, data.a, data.d, data.m);
            CSGOCli.itemDataRequest(data.s, data.a, data.d, data.m);
            resolve("idk");
        })
    }
}

module.exports = Bot;
