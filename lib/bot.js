const fs = require('fs'),
    crypto = require('crypto'),
    Long = require('long'),
    SteamTotp = require('steam-totp'),
    EventEmitter = require('events').EventEmitter;

class Bot extends EventEmitter {
    constructor(settings, servers) {
        super();

        this.settings = settings;
        this.steamReady = false;
        this.clientReady = false;
        this.busy = false;
        this.currentRequest = false;
        this.ttlTimeout = false;
        this.relogTimeout = false;
        this.servers = servers;
    }

    logIn(username, password, auth, show_in_game) {
        this.emit('unready');

        if (arguments.length === 4) {
            this.username = username;
            this.password = password;
            this.auth = auth;
            this.show_in_game = show_in_game;
        }

        console.log(`Logging in ${this.username}`);

        // Prevent lingering values across login sessions by importing here
        this.Steam = require('steam');
        this.csgo = require('csgo');

        // If there is a server list, use it
        if (this.servers) this.Steam.servers = this.servers;

        // If there is a steam client, make sure it is disconnected
        if (this.steamClient) this.steamClient.disconnect();

        this.steamClient = new this.Steam.SteamClient();
        this.steamUser = new this.Steam.SteamUser(this.steamClient);
        this.steamFriends = new this.Steam.SteamFriends(this.steamClient);
        this.steamGC = new this.Steam.SteamGameCoordinator(this.steamClient, 730);
        this.csgoClient = new this.csgo.CSGOClient(this.steamUser, this.steamGC, false);

        // set up event handlers
        this.bindEventHandlers();

        this.sentryPath = `sentry/${this.username}.sentry`;

        this.loginData = {
            account_name: this.username,
            password: this.password
        };

        if (this.auth && this.auth !== '') {
            // Check if it is a shared_secret
            if (this.auth.length <= 5) this.loginData.auth_code = this.auth;
            else {
                // Generate the code from the shared_secret
                console.log(`${this.username} Generating TOTP Code from shared_secret`);
                this.loginData.two_factor_code = SteamTotp.getAuthCode(this.auth);
            }
        }

        let sentry = null;

        if (fs.existsSync(this.sentryPath)) {
            sentry = fs.readFileSync(this.sentryPath);
        }

        if (sentry && sentry.length) {
            this.loginData.sha_sentryfile = crypto.createHash('sha1').update(sentry).digest();
        }

        console.log(`${this.username} About to connect`);
        this.steamClient.connect();
    }

    reLogIn() {
        if (this.relogTimeout) clearTimeout(this.relogTimeout);

        this.steamReady = false;
        this.clientReady = false;

        this.relogTimeout = setTimeout(() => {
            this.logIn();
        }, 10000);
    }

    bindEventHandlers() {
        this.steamClient.once('connected', () => {
            this.steamReady = true;

            console.log(`${this.username} Connected`);
            this.steamUser.logOn(this.loginData);
        });

        this.steamClient.once('error', (err) => {
            console.log(err);

            this.reLogIn();
        });

        this.steamClient.once('loggedOff', () => {
            console.log(`${this.username} Logged off, reconnecting!`);

            this.reLogIn();
        });

        this.steamClient.once('servers', (servers) => {
            console.log(`${this.username} Received servers.`);
            fs.writeFileSync('servers.json', JSON.stringify(servers, null, 2));
        });

        this.steamClient.once('sentry', (sentry) => {
            console.log(`${this.username} Received sentry.`);
            fs.writeFileSync(this.sentryPath, sentry);
        });

        this.steamUser.on('updateMachineAuth', (sentry, callback) => {
            fs.writeFileSync(this.sentryPath, sentry.bytes);

            let sha_file = crypto.createHash('sha1').update(sentry.bytes).digest();

            callback({ sha_file: sha_file });
        });

        this.steamClient.once('logOnResponse', (response) => {
            if (response.eresult == this.Steam.EResult.OK) {
                console.log(`${this.username} Log on OK`);

                if (this.show_in_game === undefined || this.show_in_game === true) {
                    this.steamFriends.setPersonaState(this.Steam.EPersonaState.Busy);
                }

                this.csgoClient.launch();
            }
            else {
                console.log(`Error logging in ${this.username}:`, response);

                let login_error_msgs = {
                    61: 'Invalid Password',
                    63: 'Account login denied due to 2nd factor authentication failure. If using email auth, an email has been sent.',
                    65: 'Account login denied due to auth code being invalid',
                    66: 'Account login denied due to 2nd factor auth failure and no mail has been sent'
                };

                if (response.eresult && login_error_msgs[response.eresult] != undefined) {
                    console.log(this.username + ': ' + login_error_msgs[response.eresult]);
                }   
            }
        });

        this.csgoClient.on('itemData', (itemData) => {
            if (this.resolve && this.currentRequest) {
                // Ensure the received itemid is the same as what we want
                let itemid = itemData.iteminfo.itemid;
                itemData.iteminfo.itemid_int = new Long(itemid.low, itemid.high, itemid.unsigned).toNumber();

                if (itemData.iteminfo.itemid != parseInt(this.currentRequest.a)) return;

                // Clear any TTL timeout
                if (this.ttlTimeout) {
                    clearTimeout(this.ttlTimeout);
                    this.ttlTimeout = false;
                }

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

        this.csgoClient.on('ready', () => {
            console.log(`${this.username} CSGO Client Ready!`);

            this.clientReady = true;
            this.emit('ready');
        });

        this.csgoClient.on('unready', () => {
            console.log(`${this.username} CSGO unready, trying to reconnect!`);

            this.reLogIn();
        });

        this.csgoClient.on('unhandled', (msg) => {
            console.log(`${this.username} Unhandled msg: ${msg}`);
        });
    }

    sendFloatRequest(data, id) {
        return new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
            this.busy = true;

            console.log(`${this.username} Fetching for ${id}`);

            this.currentRequest = {s: data.s, a: data.a, d: data.d, m: data.m, time: new Date().getTime()};

            if (!this.clientReady) reject('This bot is not ready');
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
