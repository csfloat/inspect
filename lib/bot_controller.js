const Bot = require('./bot'),
    EventEmitter = require('events').EventEmitter;

class BotController extends EventEmitter {
    constructor() {
        super();

        this.readyEvent = false;
        this.bots = [];
    }

    addBot(loginData, settings) {
        let bot = new Bot(settings);
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
            if (!bot.busy && bot.ready) return bot;
        }

        return false;
    }

    hasBotOnline() {
        for (let bot of this.bots) {
            if (bot.ready) return true;
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
