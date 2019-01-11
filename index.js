const optionDefinitions = [
    { name: 'config', alias: 'c', type: String, defaultValue: './config.js' }
];

const fs = require('fs'),
    winston = require('winston'),
    args = require('command-line-args')(optionDefinitions),
    queue = new (require('./lib/queue'))(),
    utils = require('./lib/utils'),
    InspectURL = require('./lib/inspect_url'),
    botController = new (require('./lib/bot_controller'))(),
    resHandler = require('./lib/res_handler'),
    CONFIG = require(args.config),
    DB = new (require('./lib/db'))(CONFIG.database_url),
    gameData = new (require('./lib/game_data'))(CONFIG.game_files_update_interval, CONFIG.enable_game_file_updates);

winston.level = CONFIG.logLevel || 'debug';

const errorMsgs = {
    1: 'Improper Parameter Structure',
    2: 'Invalid Inspect Link Structure',
    3: 'You may only have one pending request at a time',
    4: 'Valve\'s servers didn\'t reply in time',
    5: 'Valve\'s servers appear to be offline, please try again later',
    6: 'Something went wrong on our end, please try again'
};

if (CONFIG.logins.length === 0) {
    console.log('There are no bot logins. Please add some in config.json');
    process.exit(1);
}

// If the sentry folder doesn't exist, create it
if (!utils.isValidDir('sentry')) {
    winston.info('Creating sentry directory');
    fs.mkdirSync('sentry');
}

for (let loginData of CONFIG.logins) {
    botController.addBot(loginData, CONFIG.bot_settings);
}

const lookupHandler = function (params) {
    // Check if the item is already in the DB
    DB.getItemData(params).then((doc) => {
        // If we got the result, just return it
        if (doc) {
            gameData.addAdditionalItemProperties(doc);
            resHandler.respondFloatToUser(params, {'iteminfo': doc});
            return;
        }

        // Check if there is a bot online to process this request
        if (!botController.hasBotOnline()) {
            resHandler.respondErrorToUser(params, {error: errorMsgs[5], code: 5}, 503);
            return;
        }

        // If the flag is set, check if the user already has a request in the queue
        if (!CONFIG.allow_simultaneous_requests && queue.isUserInQueue(params.ip)) {
            resHandler.respondErrorToUser(params, {error: errorMsgs[3], code: 3}, 400);
            return;
        }

        queue.addJob(params, CONFIG.bot_settings.max_attempts);

        if (params.type === 'ws') {
            resHandler.respondInfoToUser(params, {'msg': `Your request for ${params.a} is in the queue`});
        }
    }).catch((err) => {
        winston.error(`getItemData Promise rejected: ${err.message}`);
        resHandler.respondErrorToUser(params, {error: errorMsgs[6], code: 6}, 500);
    });
};

// Setup and configure express
const app = require('express')();

if (CONFIG.trust_proxy === true) {
    app.enable('trust proxy');
}

CONFIG.allowed_regex_origins = CONFIG.allowed_regex_origins || [];
CONFIG.allowed_origins = CONFIG.allowed_origins || [];
const allowedRegexOrigins = CONFIG.allowed_regex_origins.map((origin) => new RegExp(origin));

app.get('/', function(req, res) {
    // Allow some origins
    if (CONFIG.allowed_origins.length > 0 && req.get('origin') != undefined) {
        // check to see if its a valid domain
        const allowed = CONFIG.allowed_origins.indexOf(req.get('origin')) > -1 ||
            allowedRegexOrigins.findIndex((reg) => reg.test(req.get('origin'))) > -1;

        if (allowed) {
            res.header('Access-Control-Allow-Origin', req.get('origin'));
            res.header('Access-Control-Allow-Methods', 'GET');
        }
    }

    // Get and parse parameters
    let thisLink;

    if ('url' in req.query) {
        thisLink = new InspectURL(req.query.url);
    }
    else if ('a' in req.query && 'd' in req.query && ('s' in req.query || 'm' in req.query)) {
        thisLink = new InspectURL(req.query);
    }

    // Make sure the params are valid
    if (!thisLink || !thisLink.getParams()) {
        res.status(400).json({error: errorMsgs[2], code: 2});
        return;
    }

    // Look it up
    let params = thisLink.getParams();

    params.ip = req.ip;
    params.type = 'http';
    params.res = res;

    lookupHandler(params);
});

let http_server = require('http').Server(app);

let https_server;

if (CONFIG.https.enable) {
    const credentials = {
        key: fs.readFileSync(CONFIG.https.key_path, 'utf8'),
        cert: fs.readFileSync(CONFIG.https.cert_path, 'utf8'),
        ca: fs.readFileSync(CONFIG.https.ca_path, 'utf8')
    };

    https_server = require('https').Server(credentials, app);
}


if (CONFIG.http.enable) {
    http_server.listen(CONFIG.http.port);
    winston.info('Listening for HTTP on port: ' + CONFIG.http.port);
}

if (CONFIG.https.enable) {
    https_server.listen(CONFIG.https.port);
    winston.info('Listening for HTTPS on port: ' + CONFIG.https.port);
}


if (CONFIG.socketio.enable) {
    let io;

    if (https_server) {
        io = require('socket.io')(https_server);
        winston.info('Listening for HTTPS websocket connections on port: ' + CONFIG.https.port);
    }
    else {
        // Fallback onto HTTP for socket.io
        io = require('socket.io')(http_server);
        winston.info('Listening for HTTP websocket connections on port: ' + CONFIG.http.port);
    }

    if (CONFIG.socketio.origins) {
        io.set('origins', CONFIG.socketio.origins);
    }

    io.on('connection', function(socket) {
        socket.emit('joined');

        if (botController.hasBotOnline() === false) {
            socket.emit('errormessage', {error: errorMsgs[5], code: 5});
        }

        socket.on('lookup', function(link) {
            link = new InspectURL(link);
            let params = link.getParams();

            if (link && params) {
                params.ip = socket.request.connection.remoteAddress;
                params.type = 'ws';
                params.res = socket;

                lookupHandler(params);
            }
            else {
                socket.emit('errormessage', {error: errorMsgs[2], code: 2});
            }
        });
    });

    botController.on('ready', () => {
        winston.debug('Telling WS Users that Valve is online');
        io.emit('successmessage', {'msg': 'Valve\'s servers are online!'});
    });

    botController.on('unready', () => {
        winston.debug('Telling WS Users that Valve is offline');
        io.emit('errormessage', {error: errorMsgs[5], code: 5});
    });
}

queue.process(CONFIG.logins.length, (job) => {
    return new Promise((resolve, reject) => {
        botController.lookupFloat(job.data)
        .then((itemData) => {
            winston.debug(`Received itemData for ${job.data.a}`);

            // Save and remove the delay attribute
            let delay = itemData.delay;
            delete itemData.delay;

            // add the item info to the DB
            DB.insertItemData(itemData.iteminfo);

            gameData.addAdditionalItemProperties(itemData.iteminfo);
            resHandler.respondFloatToUser(job.data, itemData);

            resolve(delay);
        })
        .catch(() => {
            winston.warn(`Request Timeout for ${job.data.a}`);
            reject();
        });
    });
});

queue.on('job failed', (job) => {
    winston.warn(`Job Failed! S: ${job.data.s} A: ${job.data.a} D: ${job.data.d} M: ${job.data.m} IP: ${job.data.ip}`);

    resHandler.respondErrorToUser(job.data, {error: errorMsgs[4], code: 4}, 500);
});
