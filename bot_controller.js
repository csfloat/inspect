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

    lookupFloat(data) {
        return this.bots[0].sendFloatRequest(data);
    }
}

module.exports = BotController;
