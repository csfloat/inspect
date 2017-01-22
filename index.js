const fs = require('fs'),
    kue = require('kue'),
    queue = kue.createQueue(),
    CONFIG = require('./config'),
    utils = require('./lib/utils'),
    InspectURL = require('./lib/inspect_url'),
    botController = new (require('./lib/bot_controller'))(),
    resController = new (require('./lib/res_controller'))(),
    DB = new (require('./lib/db'))(CONFIG.database_url),
    gameData = new (require('./lib/game_data'))(CONFIG.game_files_update_interval, CONFIG.enable_game_file_updates);

const errorMsgs = {
    1: 'Improper Parameter Structure',
    2: 'Invalid Inspect Link Structure',
    3: 'You may only have one pending request at a time',
    4: 'Valve\'s servers didn\'t reply in time',
    5: 'Valve\'s servers appear to be offline, please try again later'
};

if (CONFIG.logins.length == 0) {
    console.log('There are no bot logins. Please add some in config.json');
    process.exit(1);
}

// If the sentry folder doesn't exist, create it
if (!utils.isValidDir('sentry')) {
    console.log('Creating sentry directory');
    fs.mkdirSync('sentry');
}

for (let loginData of CONFIG.logins) {
    botController.addBot(loginData, CONFIG.bot_settings);
}

const createJob = function(data, saveCallback) {
    queue.create('floatlookup', data)
    .ttl(CONFIG.bot_settings.request_ttl)
    .attempts(CONFIG.bot_settings.max_attempts)
    .removeOnComplete(true)
    .save(saveCallback);
};

const lookupHandler = function (params) {
    // Check if the item is already in the DB
    DB.getItemData(params, function (err, doc) {
        let userAlreadyInQueue = resController.isUserInQueue(params.ip);

        // Add the user to the res controller
        resController.addUserRequest(params);

        // If we got the result, just return it
        if (doc) {
            gameData.addAdditionalItemProperties(doc);

            resController.respondFloatToUser(params.ip, params, {'iteminfo': doc});
            return;
        }

        // Check if there is a bot online to process this request
        if (!botController.hasBotOnline()) {
            resController.respondErrorToUser(params.ip, params, {error: errorMsgs[5], code: 5}, 503);
            return;
        }

        // If the flag is set, check if the user already has a request in the queue
        if (!CONFIG.allow_simultaneous_requests && userAlreadyInQueue) {
            resController.respondErrorToUser(params.ip, params, {error: errorMsgs[3], code: 3}, 400);
            return;
        }

        // Remove this object since it can't be serialized in Redis
        delete params.res;

        // Create the job, if it is a websocket user, tell them
        createJob(params, () => {
            if (params.type === 'ws') {
                resController.respondInfoToUser(params.ip, params, {'msg': `Your request for ${params.a} is in the queue`});
            }
        });
    });
};

// Setup and configure express
let app = require('express')();

app.get('/', function(req, res) {
    // Allow some origins
    if (CONFIG.allowed_origins.length > 0 && req.get('origin') != undefined) {
        // check to see if its a valid domain
        if (CONFIG.allowed_origins.indexOf(req.get('origin')) !== -1) {
            res.header('Access-Control-Allow-Origin', req.get('origin'));
            res.header('Access-Control-Allow-Methods', 'GET');
        }
    }

    // Get and parse parameters
    let thisLink;

    if ('url' in req.query) thisLink = new InspectURL(req.query.url);
    else if ('a' in req.query && 'd' in req.query && ('s' in req.query || 'm' in req.query)) thisLink = new InspectURL(req.query);

    // Make sure the params are valid
    if (!thisLink || !thisLink.getParams()) {
        res.status(400).json({error: errorMsgs[2], code: 2});
        return;
    }

    // Look it up
    let params = thisLink.getParams();

    params.ip = req.connection.remoteAddress;
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
    console.log('Listening for HTTP on port: ' + CONFIG.http.port);
}

if (CONFIG.https.enable) {
    https_server.listen(CONFIG.https.port);
    console.log('Listening for HTTPS on port: ' + CONFIG.https.port);
}


if (CONFIG.socketio.enable) {
    let io;

    if (https_server) {
        io = require('socket.io')(https_server);
        console.log('Listening for HTTPS websocket connections on port: ' + CONFIG.https.port);
    }
    else {
        // Fallback onto HTTP for socket.io
        io = require('socket.io')(http_server);
        console.log('Listening for HTTP websocket connections on port: ' + CONFIG.http.port);
    }

    if (CONFIG.socketio.origins) {
        io.set('origins', CONFIG.socketio.origins);
    }

    io.on('connection', function(socket) {
        socket.emit('joined');

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
}

// Remove any current inactive jobs in the Kue
queue.inactive(function(err, ids) {
    ids.forEach(function(id) {
        try {
            kue.Job.get(id, function(err, job) {
                if (job != undefined) {
                    job.remove();
                }
            });
        }
        catch (err) {
            console.log('Couldn\'t obtain job', id, 'when parsing inactive jobs');
        }
    });
});

// Remove any current active jobs in the Kue
queue.active(function(err, ids) {
    ids.forEach(function(id) {
        try {
            kue.Job.get(id, function(err, job) {
                if (job != undefined) {
                    job.remove();
                }
            });
        }
        catch (err) {
            console.log('Couldn\'t obtain job', id, 'when parsing active jobs');
        }
    });
});

queue.process('floatlookup', CONFIG.logins.length, (job, done) => {
    botController.lookupFloat(job.data)
    .then((itemData) => {
        console.log('Recieved itemData for ' + job.data.a + ' ID: ' + job.id);

        // Save and remove the delay attribute
        let delay = itemData.delay;
        delete itemData.delay;

        // add the item info to the DB
        DB.insertItemData(itemData.iteminfo);

        gameData.addAdditionalItemProperties(itemData.iteminfo);
        resController.respondFloatToUser(job.data.ip, job.data, itemData);

        setTimeout(() => {
            done();
        }, delay);
    })
    .catch((err) => {
        resController.respondErrorToUser(job.data.ip, job.data, {error: errorMsgs[4], code: 4}, 500);
        console.log('Job Error:', err);
        done(String(err));
    });
});

queue.on('job failed', function(id) {
    console.log('Job', id, 'Failed!');
    try {
        kue.Job.get(id, function(err, job) {
            if (job && job.data) {
                resController.respondErrorToUser(job.data.ip, job.data, {error: errorMsgs[4], code: 4}, 500);
                job.remove();
            }
        });
    }
    catch (err) {
        console.log('Couldn\'t obtain failed job', id);
    }
});

process.once('SIGTERM', () => {
    queue.shutdown(5000, (err) => {
        console.log('Kue shutdown: ', err || '');
        process.exit(0);
    });
});
