const https = require('https'),
    fs = require('fs');

/*
    Downloads the given HTTPS file
*/
exports.downloadFile = function(url, cb) {
    https.get(url, function(res) {
        let errored = false;

        if (res.statusCode !== 200 && !errored) {
            cb();
            return;
        }

        res.setEncoding('utf8');
        let data = '';

        res.on('error', function(err) {
            cb();
            errored = true;
        });

        res.on('data', function(chunk) {
            data += chunk;
        });

        res.on('end', function() {
            cb(data);
        });
    });
};

/*
    Returns a boolean as to whether the specified path is a directory and exists
*/
exports.isValidDir = function(path) {
    try {
        return fs.statSync(path).isDirectory();
    } catch (e) {
        return false;
    }
};

/*
    Returns a boolean as to whether the string only contains numbers
*/
exports.isOnlyDigits = function (num) {
    return /^\d+$/.test(num);
};

/*
    Filters the keys in the given object and returns new one
*/
exports.filterKeys = function (keys, obj) {
    return keys.reduce((result, key) => {
        if (key in obj) result[key] = obj[key];
        return result;
    }, {});
};

/*
    Removes keys with null values
 */
exports.removeNullValues = function (obj) {
    return Object.keys(obj).reduce((result, key) => {
        if (key in obj && obj[key] !== null) {
            result[key] = obj[key];
        }

        return result;
    }, {});
};

/*
    Converts the given unsigned 64 bit integer into a signed 64 bit integer
 */
exports.unsigned64ToSigned = function (num) {
    const mask = 1n << 63n;
    return (BigInt(num)^mask) - mask;
};

/*
    Converts the given signed 64 bit integer into an unsigned 64 bit integer
 */
exports.signed64ToUnsigned = function (num) {
    const mask = 1n << 63n;
    return (BigInt(num)+mask) ^ mask;
};

/*
    Checks whether the given ID is a SteamID64
 */
exports.isSteamId64 = function (id) {
    id = BigInt(id);
    const universe = id >> 56n;
    if (universe > 5n) return false;

    const instance = (id >> 32n) & (1n << 20n)-1n;

    // There are currently no documented instances above 4, but this is for good measure
    return instance <= 32n;
};

/*
    Chunks array into sub-arrays of the given size
 */
exports.chunkArray = function (arr, size) {
    return new Array(Math.ceil(arr.length / size)).fill().map(_ => arr.splice(0,size));
};

