var mongo = require('mongodb');

var server = mongo.Server,
    Db = mongo.Db;

var server = new server('localhost', 27017, {auto_reconnect: true});
db = new Db('CSGOFloatdb', server);

db.open(function(err, db) {
    if(!err) {
        console.log("Connected to 'CSGOFloatdb' database");
        db.collection('marketfloats', {strict:true}, function(err, collection) {
            if (err) {
                console.log("There are currently no floats in the db");
            }
        });
    }
});


exports.insertFloat = function(itemdata, callback) {
    // Insert new float in the DB
    if ('item_name' in itemdata) {
        db.collection('marketfloats', function(err, collection) {
            collection.insert(itemdata, {safe:true}, function(err, result) {
                if (!err) {
                    // We don't need to send over the _id
                    delete itemdata["_id"];
                    callback(null, true);
                }
                else {
                    callback(err, false);
                }
            });
        });  
    }
    else {
        console.log("This item has no item_name property, not adding to DB");
        callback(true, false);
    }
};

exports.checkInserted = function(lookupVars, callback) {
    // checks whether the given request already exists in the database, so we can just return that
    // rather than placing it in a queue

    db.collection('marketfloats', function(err, collection) {
        collection.findOne({s: lookupVars[0], a: lookupVars[1], d: lookupVars[2], m: lookupVars[3]}, function(err, doc) {
            // this will just be array of elements
            if(doc === null){
                callback(null, false);
            } else {
                delete doc["_id"]; // We don't need to return this
                callback(null, doc);
            };
        });
    });
};