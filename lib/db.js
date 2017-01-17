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
        });
    }

    insertItemData(itemdata) {
        if (this.connected) {
            this.db.collection('marketfloats').insert(JSON.parse(JSON.stringify(itemdata)));
        }
    }

    getItemData(params, cb) {
        if (this.connected) {
            this.db.collection('marketfloats').findOne({ s: params.s, a: params.a, d: params.d, m: params.m }, function(err, doc) {
                // If there is the id field, remove it
                if (doc !== null) delete doc['_id'];

                cb(null, doc);
            });
        }
        else cb(null, null);
    }
}

module.exports = DB;
