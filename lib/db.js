const MongoClient = require('mongodb').MongoClient,
    winston = require('winston');

class DB {
    constructor(url) {
        this.connected = false;

        if (url) {
            MongoClient.connect(url, (err, db) => {
                if (err) {
                    winston.error(`Failed to connect to MongoDB: ${err}`);
                    return;
                }

                winston.info('Connected to the database');

                this.db = db;
                this.connected = true;

                this.ensureIndex();
            });
        }
    }

    ensureIndex() {
        if (this.connected) {
            this.db.collection('marketfloats').createIndex({s: 1, a: 1, d: 1, m: 1}, {unique: true}, (err) => {
                if (err) winston.error(`Failed to create MongoDB index: ${err}`);
            });
        }
    }

    insertItemData(itemdata) {
        if (this.connected) {
            this.db.collection('marketfloats').insertOne(JSON.parse(JSON.stringify(itemdata)), (err) => {
                if (err) winston.error(`Failed to insert ${itemdata.a} into MongoDB: ${err}`);
            });
        }
    }

    getItemData(params) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                return resolve(null);
            }

            let data = { s: params.s, a: params.a, d: params.d, m: params.m };

            this.db.collection('marketfloats').findOne(data, (err, doc) => {
                if (err) return reject({message: `Error reading item data from DB: ${err}`});

                // If there is the id field, remove it
                if (doc !== null) delete doc['_id'];

                resolve(doc);
            });
        });
    }
}

module.exports = DB;
