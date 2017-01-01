const Bot = require("./bot");

class BotController {
    constructor() {
        this.bots = [];
    }

    addBot(loginData) {
        let bot = new Bot();
        bot.logIn(loginData.user, loginData.pass, loginData.auth);
        this.bots.push(bot);
    }

    getFreeBot() {
        for (var bot of this.bots) {
            if (!bot.busy && bot.clientReady) return bot;
        }

        return false;
    }

    isBotOnline() {
        for (var bot of this.bots) {
            if (bot.clientReady) return true;
        }

        return false;
    }

    lookupFloat(data) {
        var freeBot = this.getFreeBot();

        if (freeBot) return freeBot.sendFloatRequest(data);
        else {
            return Promise.reject("There are no bots to fulfill this request");
        }
    }
}

module.exports = BotController;
