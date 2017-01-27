const https = require('https'),
    fs = require('fs');

/*
    Downloads the given HTTPS file
*/
exports.downloadFile = function(url, cb) {
    https.get(url, function(res) {
        if (res.statusCode !== 200) {
            cb();
            return;
        }

        res.setEncoding('utf8');
        let data = '';

        res.on('data', function(chunk) { data += chunk; });

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
