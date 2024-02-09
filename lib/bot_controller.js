const Bot = require("./bot"),
  utils = require("./utils"),
  EventEmitter = require("events").EventEmitter,
  errors = require("../errors");

class BotController extends EventEmitter {
  constructor(settings) {
    super();

    this.settings = settings;
    this.readyEvent = false;
    this.bots = [];
  }

  addBot(loginData) {
    let bot = new Bot(this.settings, loginData.proxy, loginData.steamID, loginData.refreshToken);
    bot.logIn();

    bot.on("ready", () => {
      if (!this.readyEvent && this.hasBotOnline()) {
        this.readyEvent = true;
        this.emit("ready");
      }
    });

    bot.on("unready", () => {
      if (this.readyEvent && this.hasBotOnline() === false) {
        this.readyEvent = false;
        this.emit("unready");
      }
    });

    this.bots.push(bot);
  }

  syncBots(accounts) {
    this.bots = [];
    accounts.forEach(loginData => this.addBot(loginData));
  }

  getFreeBot() {
    // Shuffle array to evenly distribute requests
    for (let bot of utils.shuffleArray(this.bots)) {
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

  getReadyAmount() {
    let amount = 0;
    for (const bot of this.bots) {
      if (bot.ready) {
        amount++;
      }
    }
    return amount;
  }

  lookupFloat(data) {
    let freeBot = this.getFreeBot();

    if (freeBot) return freeBot.sendFloatRequest(data);
    else return Promise.reject(errors.NoBotsAvailable);
  }
}

module.exports = BotController;
