const Bot = require('./bot');

class BotController {
    constructor() {
        this.bots = [];
    }

    addBot(loginData, settings) {
        let bot = new Bot(settings);
        bot.logIn(loginData.user, loginData.pass, loginData.auth);
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
