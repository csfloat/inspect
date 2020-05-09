const Mongo = require('./mongo'),
    Postgres = require('./postgres');

class DB {
    constructor(url) {
        if (url.indexOf('postgres') > -1) {
            this.client = new Postgres(url);
        } else if (url.indexOf('mongo') > -1) {
            this.client = new Mongo(url);
        } else if (url.length > 0) {
            throw 'Invalid Database URI Connection String Type';
        }
    }

    connect() {
        if (this.client) {
            return this.client.connect();
        } else {
            return Promise.resolve();
        }
    }

    insertItemData(itemData, data) {
        if (this.client) {
            return this.client.insertItemData(itemData, data);
        } else {
            return Promise.resolve();
        }
    }

    getItemData(params) {
        if (this.client) {
            return this.client.getItemData(params);
        } else {
            return Promise.resolve();
        }
    }

    updateItemPrice(assetId, price) {
        if (this.client) {
            return this.client.updateItemPrice(assetId, price);
        } else {
            return Promise.resolve();
        }
    }

    getItemRank(id) {
        if (this.client && this.client.getItemRank) {
            return this.client.getItemRank(id);
        } else {
            return Promise.resolve({});
        }
    }
}

module.exports = DB;
