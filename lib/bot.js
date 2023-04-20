const winston = require('winston'),
    SteamUser = require('steam-user'),
    GlobalOffensive = require('globaloffensive'),
    SteamTotp = require('steam-totp'),
    EventEmitter = require('events').EventEmitter;

class Bot extends EventEmitter {
    /**
     * Sets the ready status and sends a 'ready' or 'unready' event if it has changed
     * @param {*|boolean} val New ready status
     */
    set ready(val) {
        const prev = this.ready;
        this.ready_ = val;

        if (val !== prev) {
            this.emit(val ? 'ready' : 'unready');
        }
    }

    /**
     * Returns the current ready status
     * @return {*|boolean} Ready status
     */
    get ready() {
        return this.ready_ || false;
    }

    constructor(settings) {
        super();

        this.settings = settings;
        this.busy = false;

        this.steamClient = new SteamUser(Object.assign({
            promptSteamGuardCode: false,
            enablePicsCache: true // Required to check if we own CSGO with ownsApp
        }, this.settings.steam_user));

        this.csgoClient = new GlobalOffensive(this.steamClient);

        // set up event handlers
        this.bindEventHandlers();

        // Variance to apply so that each bot relogins at different times
        const variance = parseInt(Math.random() * 4 * 60 * 1000);

        // As of 7/10/2020, GC inspect calls can timeout repeatedly for whatever reason
        setInterval(() => {
            if (this.csgoClient.haveGCSession) {
                this.relogin = true;
                this.steamClient.relog();
            }
        }, 30 * 60 * 1000 + variance);
    }

    logIn(username, password, auth) {
        this.ready = false;

        // Save these parameters if we login later
        if (arguments.length === 3) {
            this.username = username;
            this.password = password;
            this.auth = auth;
        }

        winston.info(`Logging in ${this.username}`);

        // If there is a steam client, make sure it is disconnected
        if (this.steamClient) this.steamClient.logOff();

        this.loginData = {
            accountName: this.username,
            password: this.password,
            rememberPassword: true,
        };

        if (this.auth && this.auth !== '') {
            // Check if it is a shared_secret
            if (this.auth.length <= 5) this.loginData.authCode = this.auth;
            else {
                // Generate the code from the shared_secret
                winston.debug(`${this.username} Generating TOTP Code from shared_secret`);
                this.loginData.twoFactorCode = SteamTotp.getAuthCode(this.auth);
            }
        }

        winston.debug(`${this.username} About to connect`);
        this.steamClient.logOn(this.loginData);
    }

    bindEventHandlers() {
        this.steamClient.on('error', (err) => {
            winston.error(`Error logging in ${this.username}:`, err);

            let login_error_msgs = {
                61: 'Invalid Password',
                63: 'Account login denied due to 2nd factor authentication failure. ' +
                    'If using email auth, an email has been sent.',
                65: 'Account login denied due to auth code being invalid',
                66: 'Account login denied due to 2nd factor auth failure and no mail has been sent'
            };

            if (err.eresult && login_error_msgs[err.eresult] !== undefined) {
                winston.error(this.username + ': ' + login_error_msgs[err.eresult]);
            }

            // Yes, checking for string errors sucks, but we have no other attributes to check
            // this error against.
            if (err.toString().includes('Proxy connection timed out')) {
                this.logIn();
            }
        });

        this.steamClient.on('disconnected', (eresult, msg) => {
            winston.warn(`${this.username} Logged off, reconnecting! (${eresult}, ${msg})`);
        });

        this.steamClient.on('loggedOn', (details, parental) => {
            winston.info(`${this.username} Log on OK`);

            // Fixes reconnecting to CS:GO GC since node-steam-user still assumes we're playing 730
            // and never sends the appLaunched event to node-globaloffensive
            this.steamClient.gamesPlayed([], true);

            if (this.relogin) {
                // Don't check ownership cache since the event isn't always emitted on relogin
                winston.info(`${this.username} Initiating GC Connection, Relogin`);
                this.steamClient.gamesPlayed([730], true);
                return;
            }

            // Ensure we own CSGO
            // We have to wait until app ownership is cached to safely check
            this.steamClient.once('appOwnershipCached', () => {
                if (!this.steamClient.ownsApp(730)) {
                    winston.info(`${this.username} doesn't own CS:GO, retrieving free license`);

                    // Request a license for CS:GO
                    this.steamClient.requestFreeLicense([730], (err, grantedPackages, grantedAppIDs) => {
                        winston.debug(`${this.username} Granted Packages`, grantedPackages);
                        winston.debug(`${this.username} Granted App IDs`, grantedAppIDs);

                        if (err) {
                            winston.error(`${this.username} Failed to obtain free CS:GO license`);
                        } else {
                            winston.info(`${this.username} Initiating GC Connection`);
                            this.steamClient.gamesPlayed([730], true);
                        }
                    });
                } else {
                    winston.info(`${this.username} Initiating GC Connection`);
                    this.steamClient.gamesPlayed([730], true);
                }
            });
        });

        this.csgoClient.on('inspectItemInfo', (itemData) => {
            if (this.resolve && this.currentRequest) {
                itemData = {iteminfo: itemData};

                // Ensure the received itemid is the same as what we want
                if (itemData.iteminfo.itemid !== this.currentRequest.a) return;

                // Clear any TTL timeout
                if (this.ttlTimeout) {
                    clearTimeout(this.ttlTimeout);
                    this.ttlTimeout = false;
                }

                // GC requires a delay between subsequent requests
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

                // If the paintseed is 0, the proto returns null, force 0
                itemData.iteminfo.paintseed = itemData.iteminfo.paintseed || 0;

                // paintwear -> floatvalue to match previous API version response
                itemData.iteminfo.floatvalue = itemData.iteminfo.paintwear;
                delete itemData.iteminfo.paintwear;

                // Backwards compatibility with previous node-globaloffensive versions
                for (const sticker of itemData.iteminfo.stickers) {
                    sticker.stickerId = sticker.sticker_id;
                    delete sticker.sticker_id;
                }

                this.resolve(itemData);
                this.resolve = false;
                this.currentRequest = false;

                setTimeout(() => {
                    // We're no longer busy (satisfied request delay)
                    this.busy = false;
                }, delay);
            }
        });

        this.csgoClient.on('connectedToGC', () => {
            winston.info(`${this.username} CSGO Client Ready!`);

            this.ready = true;
        });

        this.csgoClient.on('disconnectedFromGC', (reason) => {
            winston.warn(`${this.username} CSGO unready (${reason}), trying to reconnect!`);
            this.ready = false;

            // node-globaloffensive will automatically try to reconnect
        });

        this.csgoClient.on('connectionStatus', (status) => {
            winston.debug(`${this.username} GC Connection Status Update ${status}`);
        });

        this.csgoClient.on('debug', (msg) => {
            winston.debug(msg);
        });
    }

    sendFloatRequest(link) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.busy = true;

            const params = link.getParams();
            winston.debug(`${this.username} Fetching for ${params.a}`);

            this.currentRequest = {s: params.s, a: params.a, d: params.d, m: params.m, time: new Date().getTime()};

            if (!this.ready) {
                reject('This bot is not ready');
            }
            else {
                // The first param (owner) depends on the type of inspect link
                this.csgoClient.inspectItem(params.s !== '0' ? params.s : params.m, params.a, params.d);
            }

            // Set a timeout in case the GC takes too long to respond
            this.ttlTimeout = setTimeout(() => {
                // GC didn't respond in time, reset and reject
                this.busy = false;
                this.currentRequest = false;
                reject('ttl exceeded');
            }, this.settings.request_ttl);
        });
    }
}

module.exports = Bot;
