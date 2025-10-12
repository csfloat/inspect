class PairScheduler{
	constructor(pairs) {
		this.clock = 1;
		this.items = pairs.map(x => ({ ...x, lastUsed: 0 }));
	}
	next() {
		let min = this.items[0], idx = 0;
		for (let i = 1; i < this.items.length; i++) {
			if (this.items[i].lastUsed < min.lastUsed) {
				min = this.items[i];
				idx = i;
			}
		}
		this.items[idx].lastUsed = this.clock++;
		return { bot: this.items[idx].bot, proxy: this.items[idx].proxy };
	}
	all() {
		return this.items.map(({ bot, proxy }) => ({ bot, proxy }));
	}
}
module.exports = PairScheduler;