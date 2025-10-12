const Bot = require('./bot'),
    utils = require('./utils'),
    EventEmitter = require('events').EventEmitter,
    errors = require('../errors');

class BotController extends EventEmitter {
    constructor() {
        super();

        this.readyEvent = false;
		this.bots = [];
		this.byId = new Map();
		this.scheduler = null;
    }

    addBot(loginData, settings) {
        let bot = new Bot(settings);
        bot.logIn(loginData.user, loginData.pass, loginData.auth);

        this.bots.push(bot);
        this.byId.set(bot.id, bot);

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

        return bot;
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
        const pair = this.getFreePair();
        if (pair) return pair.bot.sendFloatRequest(data);

        const freeBot = this.getFreeBot();
        if (freeBot) return freeBot.sendFloatRequest(data);

        return Promise.reject(errors.NoBotsAvailable);
    }

    setScheduler(scheduler) {
		this.scheduler = scheduler;
	}

	getFreePair() {
		if (!this.scheduler) return null;
		const tries = this.bots.length;
		for (let i = 0; i < tries; i++) {
			const { bot: botId, proxy } = this.scheduler.next();
			const b = this.byId.get(botId);
			if (b && b.ready && !b.busy) return { bot: b, proxy };
		}
		return null;
	}
}

module.exports = BotController;
