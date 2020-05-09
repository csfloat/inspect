const MongoClient = require('mongodb').MongoClient,
    winston = require('winston');

class Mongo {
    constructor(url) {
        this.url = url;
    }

    connect() {
        return new Promise((resolve, reject) => {
            MongoClient.connect(this.url, async (err, db) => {
                if (err) {
                    reject(err);
                }

                winston.info('Connected to the database');

                this.db = db;

                try {
                    await this.ensureIndex();
                } catch (e) {
                    // Gracefully handle
                    winston.error(e);
                }

                resolve();
            });
        });
    }

    ensureIndex() {
        return new Promise((resolve, reject) => {
            this.db.collection('marketfloats').createIndex({s: 1, a: 1, d: 1, m: 1}, {unique: true}, (err) => {
                if (err) {
                    reject(`Failed to create MongoDB index: ${err}`);
                } else {
                    resolve();
                }
            });
        });
    }

    insertItemData(itemdata) {
        return new Promise((resolve, reject) => {
            this.db.collection('marketfloats').insertOne(JSON.parse(JSON.stringify(itemdata)), (err) => {
                if (err) winston.error(`Failed to insert ${itemdata.a} into MongoDB: ${err}`);
                resolve(); // mimic current logic, don't reject on error
            });
        });
    }

    getItemData(params) {
        return new Promise((resolve, reject) => {
            const data = { s: params.s, a: params.a, d: params.d, m: params.m };

            this.db.collection('marketfloats').findOne(data, (err, doc) => {
                if (err) return reject({message: `Error reading item data from DB: ${err}`});

                // If there is the id field, remove it
                if (doc !== null) delete doc['_id'];

                resolve(doc);
            });
        });
    }

    updateItemPrice(assetId, price) {
        // STUB
    }


}

module.exports = Mongo;
