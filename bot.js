const fs = require("fs"),
    Steam = require("steam"),
    csgo = require("csgo"),
    crypto = require("crypto");

class Bot {
    constructor(settings) {
        this.settings = settings;
        this.steamReady = false;
        this.clientReady = false;
        this.busy = false;
        this.currentRequest = false;
        this.ttlTimeout = false;

        this.steamClient = new Steam.SteamClient();
        this.steamUser = new Steam.SteamUser(this.steamClient);
        this.steamGC = new Steam.SteamGameCoordinator(this.steamClient, 730);
        this.csgoClient = new csgo.CSGOClient(this.steamUser, this.steamGC, false);

        this.csgoClient.on("itemData", (itemData) => {
            if (this.resolve && this.currentRequest) {
                // TODO: Add error checking to make sure the ID of itemData is what we want

                // Clear any TTL timeout
                if (this.ttlTimeout) clearInterval(this.ttlTimeout);

                // Figure out how long to delay until this bot isn't busy anymore
                let offset = new Date().getTime() - this.currentRequest.time;
                let delay = this.settings.request_delay - offset;

                // If we're past the request delay, don't delay
                if (delay < 0) delay = 0;

                itemData.delay = delay;
                itemData.iteminfo.s = this.currentRequest.s;
                itemData.iteminfo.a = this.currentRequest.a;
                itemData.iteminfo.d = this.currentRequest.d;
                itemData.iteminfo.m = this.currentRequest.m;

                this.resolve(itemData);
                this.resolve = false;
                this.currentRequest = false;

                setTimeout(() => {
                    // We're no longer busy (satisfied request delay)
                    this.busy = false;
                }, delay);
            }
        });

        this.csgoClient.on("ready", () => {
            console.log("CSGO Client Ready!");

            this.clientReady = true;

            if (this.exampleTest) this.exampleTest();
        });

        this.steamUser.on("updateMachineAuth", (sentry, callback) => {
            fs.writeFileSync(this.sentryPath, sentry.bytes);

            let sha_file = crypto.createHash("sha1").update(sentry.bytes).digest();

            callback({ sha_file: sha_file });
        });
    }

    logIn(username, password, auth) {
        this.sentryPath = `sentry/${username}.sentry`;

        let loginData = {
            account_name: username,
            password: password
        };

        if (auth !== "") loginData.auth_code = auth;

        let sentry = null;

        if (fs.existsSync(this.sentryPath)) {
            sentry = fs.readFileSync(this.sentryPath);
        }

        if (sentry != undefined && sentry.length) {
            loginData.sha_sentryfile = crypto.createHash("sha1").update(sentry).digest();
        }

        console.log("About to connect");
        this.steamClient.connect();

        // set up event listeners
        this.steamClient.once("connected", () => {
            this.steamReady = true;

            console.log("Connected");
            this.steamUser.logOn(loginData);
        });

        this.steamClient.once("error", (err) => {
            console.log(err);
        });

        this.steamClient.once("servers", (servers) => {
            console.log("Received servers.");
            fs.writeFileSync('servers.json', JSON.stringify(servers, null, 2));
        });

        this.steamClient.once("sentry", (sentry) => {
            console.log("Received sentry.");
            fs.writeFileSync(this.sentryPath, sentry);
        });

        this.steamClient.once("logOnResponse", (response) => {
            if (response.eresult == Steam.EResult.OK) {
                console.log("Log on OK")
                this.csgoClient.launch();
            }
            else {
                console.log(`Error logging in ${username}:`, response);

                let login_error_msgs = {
                    61: "Invalid Password",
                    63: "Account login denied due to 2nd factor authentication failure. If using email auth, an email has been sent.",
                    65: "Account login denied due to auth code being invalid",
                    66: "Account login denied due to 2nd factor auth failure and no mail has been sent"
                };

                if (response.eresult && login_error_msgs[response.eresult] != undefined) {
                    console.log(username + ": " + login_error_msgs[response.eresult]);
                }   
            }
        });
    }

    sendFloatRequest(data) {
        return new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
            this.busy = true;

            console.log("Fetching for", data.s, data.a, data.d, data.m);

            this.currentRequest = {s: data.s, a: data.a, d: data.d, m: data.m, time: new Date().getTime()};

            if (!this.clientReady) reject("This bot is not ready");
            else this.csgoClient.itemDataRequest(data.s, data.a, data.d, data.m);

            // Set a timeout in case this request takes too long
            this.ttlTimeout = setTimeout(() => {
                // Valve didn't respond in time, reset
                this.busy = false;
                this.currentRequest = false;
            }, this.settings.request_ttl);
        });
    }
}

module.exports = Bot;
