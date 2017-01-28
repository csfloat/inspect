const MongoClient = require('mongodb').MongoClient;

class DB {
    constructor(url) {
        this.connected = false;

        MongoClient.connect(url, (err, db) => {
            if (err) {
                console.log(`Failed to connect to MongoDB: ${err}`);
                return;
            }

            console.log('Connected to the database');

            this.db = db;
            this.connected = true;

            this.ensureIndex();
        });
    }

    ensureIndex() {
        if (this.connected) {
            this.db.collection('marketfloats').createIndex({s: 1, a: 1, d: 1, m: 1}, {unique: true}, (err) => {
                if (err) console.log(`Failed to create MongoDB index: ${err}`);
            });
        }
    }

    insertItemData(itemdata) {
        if (this.connected) {
            this.db.collection('marketfloats').insertOne(JSON.parse(JSON.stringify(itemdata)), (err) => {
                if (err) console.log(`Failed to insert ${itemdata.a} into MongoDB: ${err}`);
            });
        }
    }

    getItemData(params, cb) {
        if (this.connected) {
            this.db.collection('marketfloats').findOne({ s: params.s, a: params.a, d: params.d, m: params.m }, (err, doc) => {
                // If there is the id field, remove it
                if (doc !== null) delete doc['_id'];

                cb(null, doc);
            });
        }
        else cb(null, null);
    }
}

module.exports = DB;
