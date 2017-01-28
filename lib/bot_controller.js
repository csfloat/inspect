const Bot = require('./bot'),
    fs = require('fs'),
    EventEmitter = require('events').EventEmitter;

class BotController extends EventEmitter {
    constructor() {
        super();

        this.readyEvent = false;
        this.bots = [];

        // Check if there is a servers file to use
        if (fs.existsSync('servers.json')) {
            this.servers = JSON.parse(fs.readFileSync('servers.json'));
        }
    }

    addBot(loginData, settings) {
        let bot = new Bot(settings, this.servers);
        bot.logIn(loginData.user, loginData.pass, loginData.auth, loginData.show_in_game);

        bot.on('ready', () => {
            if (!this.readyEvent && this.hasBotOnline()) {
                this.readyEvent = true;
                this.emit('ready');
            }
        });

        bot.on('unready', () => {
            if (this.readyEvent && this.hasBotOnline() === false) {
                this.readyEvent = false;
                this.emit('unready');
            }
        });

        this.bots.push(bot);
    }

    getFreeBot() {
        for (let bot of this.bots) {
            if (!bot.busy && bot.clientReady) return bot;
        }

        return false;
    }

    hasBotOnline() {
        for (let bot of this.bots) {
            if (bot.clientReady) return true;
        }

        return false;
    }

    lookupFloat(data) {
        let freeBot = this.getFreeBot();

        if (freeBot) return freeBot.sendFloatRequest(data);
        else return Promise.reject('There are no bots to fulfill this request');
    }
}

module.exports = BotController;
