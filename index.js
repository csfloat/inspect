var kue = require('kue'),
    queue = kue.createQueue(),
    cp = require('child_process'),
    dbhandler = require('./dbhandler'),
    fs = require('fs'),
    inspect_url = require("./inspect_url");

// Get the bot login info
var CONFIG = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// API Variables
var isValveOnline = false; // boolean that defines whether all the bots are offline or not
var apiObjs = {}; // Holds the request objects
var maxATTEMPTS = CONFIG.max_attempts; // Number of attempts for each request
var failedAttempts = {};

// BOT Variables
var bot_number = CONFIG.logins.length; // Stores the number of bots
var botData = []; // Stores current bot about regarding their job, child, ready/busy state, and done objects
var requestWait = CONFIG.request_delay // Milliseconds to wait between requests to Valve
var onlyRestart = false;

// Push default bot values of them being offline
for (var i = 0; i < bot_number; i++) {
    botData[i] = {};
    botData[i]["ready"] = 0;
    botData[i]["busy"] = 1;
    botData[i]["obj"] = null;
    botData[i]["childid"] = null;
    botData[i]["doneobj"] = null;
    botData[i]["requested"] = null;
}


if (bot_number == 0) {
    console.log('There are no bot logins, please input some into logins.json. Exiting...');
    process.exit(1);
}

function forkChild(index) {
    // Get the bot login info
    var cur_login = CONFIG.logins[index];
    cur_login["index"] = index;

    // Fork the bot
    console.log("Creating child process for " + cur_login["user"]);
    var newchild = cp.fork('./child.js', [JSON.stringify(cur_login, null, 2)]);

    newchild.on('message', function(m) {

        if (m[0] == "ready") {
            // This bot is logged into CSGO and is ready
            console.log("Bot " + m[1] + " is ready");

            // Set values are a ready bot
            botData[m[1]]["ready"] = 1;
            botData[m[1]]["busy"] = 0;

            var isActive = true;
            for (var activeindex = 0; activeindex < botData.length; activeindex++) {
                if (botData[activeindex]["ready"] == 0) {
                    isActive = false;
                    break;
                }
            }

            if (isActive) {
                // All the bots are online and ready
                console.log("Bots are ready to accept requests");
                if (io) io.emit('successmessage', "Valve's servers are online!");
                isValveOnline = true;

                // If a bot errored out, only restart the queue
                if (onlyRestart) {
                    apiObjs = {};
                }
                else {
                    resetQueue();
                }
            }
        }
        else if (m[0] == "genericmsg") {
            // Emit this message to a websocket client
            io.to(m[3]).emit(m[1], m[2]);
        }
        else if (m[0] == "itemdata") {
            // Tell kue that this job is finished

            // Call done on Kue
            if (m[1] in botData) {
                // Find out how long this request took
                var currenttime = new Date().getTime();
                var offset = currenttime-botData[m[1]]["requested"];

                // We ensure a delay of requestWait between requests for this bot
                if (offset < requestWait) {
                    console.log("Delaying for " + (requestWait-offset) + "ms, it took " + offset + "ms for the request " + botData[m[1]]["childid"]);

                    setTimeout(function(){
                        botData[m[1]]["doneobj"]();

                        // This bot is no longer busy (MAKE SURE THIS IS CALLED AFTER DONE)
                        // Otherwise, Kue will asign the bot with a new request and overwrite the old done object
                        // Then it will time out this good request and block the user
                        botData[m[1]]["busy"] = 0;

                    }, (requestWait-offset));
                }
                else {
                    // Just call done
                    botData[m[1]]["doneobj"]();

                    // This bot is no longer busy (MAKE SURE THIS IS CALLED AFTER DONE)
                    botData[m[1]]["busy"] = 0;
                }

                // Clear up the attempts
                if (botData[m[1]]["childid"] in failedAttempts) {
                    console.log("Clearing attempts for " + botData[m[1]]["childid"]);
                    delete failedAttempts[botData[m[1]]["childid"]];
                }
            }

            // Add the float to the DB so that it can be used next time for this same request
            dbhandler.insertFloat(m[3]["iteminfo"], function (err, result) {
                if (!err) {
                    console.log("Inserted the result into the db");
                }
                if (m[2] != null) {
                    // This is a websocket request

                    io.to(m[2]).emit("floatmessage", m[3]);

                    // found out the ip of the user and remove it from the blacklist
                    if (m[2] in io.sockets.connected) {
                        var socketip = io.sockets.connected[m[2]].request.connection.remoteAddress;
                        if (socketip in apiObjs) {
                            delete apiObjs[socketip];
                        }
                    }
                }
                else if (m[4] != null) {
                    // This is an HTTP request

                    // Reply to it and delete the user from the blacklist
                    if (apiObjs[m[4]] != undefined) {
                        apiObjs[m[4]].json(m[3]);
                        delete apiObjs[m[4]];
                    }
                }
            });
        }
        else if (m[0] == "unready") {
            console.log("Bot " + m[1] + " is not ready");

            // Bot is no longer ready
            botData[m[1]]["ready"] = 0;

            // We don't need to instantiate the queue again
            onlyRestart = true;

            // Tell websocket users
            if (isValveOnline && io) {
                io.emit('errormessage', "Valve's servers appear to be offline");
            }

            // Don't let people put in requests now
            isValveOnline = false;

            // Kill the child and relaunch it
            botData[m[1]]["obj"].kill();

            // Fork the bot again and log it in
            forkChild(m[1]);
            botData[m[1]]["obj"].send(['login']);
        }
    });

    // Store the bot in an object
    botData[index]["obj"] = newchild;
}

// Create the child processes that handle the communication to Valve
for (var x = 0; x < bot_number; x++) {
    // Create child process with it's login info
    forkChild(x);
}

dbhandler.initialize(CONFIG.database.url, CONFIG.database.port, { auto_reconnect: true })

// Setup and configure express
var app = require("express")();

app.get("/", function(req, res) {
    // Allow some origins
    if (req.get('origin') != undefined) {
        // check to see if its a valid domain
        if (CONFIG.allowed_origins.indexOf(req.get('origin')) !== -1) {
            res.header('Access-Control-Allow-Origin', req.get('origin'));
            res.header('Access-Control-Allow-Methods', 'GET');
        }
    }

    // Verify proper parameters
    var inspectURL;

    if ("url" in req.query) {
        inspectURL = req.query.url;
    } else if ("a" in req.query && "d" in req.query && ("s" in req.query || "m" in req.query)) {
        inspectURL = inspect_url.build(req.query);
    } else {
        res.status(400).json({ error: "Improper Parameter Structure", code: 1 });
        return;
    }

    var lookupVars = inspect_url.parse(inspectURL);

    // Check if there are valid variables
    if (!lookupVars) {
        res.status(400).json({ error: "Invalid Inspect Link Structure", code: 2 });
        return;
    }

    dbhandler.checkInserted(lookupVars, function(err, result) {
        if (result) {
            res.json({ iteminfo: result });
            return;
        }

        if (!isValveOnline) {
            res.status(503).json({ error: "Valve's servers appear to be offline, please try again later", code: 5 });
            return;
        }

        var userIP = req.connection.remoteAddress;

        if (userIP in apiObjs) {
            res.status(400).json({ error: "You may only have one pending request at a time", code: 3 });
            return;
        }

        apiObjs[userIP] = res;
        create_job(false, userIP, lookupVars);
    });
});

var http_server = require("http").Server(app);

var https_server;

if (CONFIG.https.enable) {
    var credentials = {
        key: fs.readFileSync(CONFIG.https.key_path, 'utf8'),
        cert: fs.readFileSync(CONFIG.https.cert_path, 'utf8')
    };

    https_server = require("https").Server(credentials, app);
}

var io;

if (https_server && CONFIG.socketio.enable) {
    io = require("socket.io")(https_server);

    io.set("origins", CONFIG.socketio.origins);
}

/*
    Handles websocket float request
*/
function LookupHandler(link, socket) {
    lookupVars = inspect_url.parse(link);

    if (lookupVars == false) {
        socket.emit("errormessage", "We couldn't parse the inspect link, are you sure it is correct?");
        return;
    }

    dbhandler.checkInserted(lookupVars, function (err, result) {
        if (result) {
            socket.emit("floatmessage", { iteminfo: result });
            return;
        }

        if (!isValveOnline) {
            socket.emit("errormessage", "Valve's servers appear to be offline, please try again later");
            return;
        }

        var socketip = socket.request.connection.remoteAddress;

        if (socketip in apiObjs) {
            socket.emit("errormessage", "You may only have one pending request at a time");
            return;
        }

        apiObjs[socketip] = true;
        create_job(socket, false, lookupVars);
    });
}

/*
Creates a Kue job given a float request
*/
function create_job(socket, request, lookupVars) {
    // Support for http and websockets

    // Create job with TTL of 2000, it will be considered a fail if a child process
    // doesn't return a value within 3sec

    var job = queue.create('floatlookup', {
        socketid: socket.id,
        request: request,
        s: lookupVars.s,
        a: lookupVars.a,
        d: lookupVars.d,
        m: lookupVars.m
    }).ttl(2000).attempts(maxATTEMPTS).removeOnComplete(true).save(function (err) {
        if (err) {
            console.log("There was an error adding the job to the queue");
            console.log(err);
            if (socket != false) {
                socket.emit("errormessage", "There was an error adding the job to the queue");
            }
        }
        else {
            if (socket != false) {
                socket.emit("infomessage", "Your request for " + lookupVars.a + " is in the queue");
            }
        }
    });
}

/*
Resets the queue (initiated once the bots login)
*/
function resetQueue() {
    if (CONFIG.http.enable) {
        http_server.listen(CONFIG.http.port);
        console.log("Listening for HTTP on port: " + CONFIG.http.port);
    }

    if (CONFIG.https.enable) {
        https_server.listen(CONFIG.https.port);
        console.log("Listening for HTTPS on port: " + CONFIG.https.port);
    }

    // Socket.io event handler
    if (CONFIG.socketio.enable) {
        io.on('connection', function(socket) {
            socket.emit('joined');
            socket.emit('infomessage', 'You no longer have to login! Have fun!');

            if (!isValveOnline) {
                socket.emit('errormessage', "Valve's servers appear to be offline, please try again later");
            }

            socket.on('lookup', function(link) {
                LookupHandler(link, socket);
            });
        });
    }

    // Remove any current inactive jobs in the Kue
    queue.inactive( function( err, ids ) {
        ids.forEach( function( id ) {
            try {
                kue.Job.get( id, function( err, job ) {
                    if (job != undefined) {
                        job.remove();
                    }
                });
            }
            catch (err) {
                console.log("Couldn't obtain job " + id + " when parsing inactive jobs");
            }
        });
    });

    // Remove any current active jobs in the Kue
    queue.active( function( err, ids ) {
        ids.forEach( function( id ) {
            try {
                kue.Job.get( id, function( err, job ) {
                    if (job != undefined) {
                        job.remove();
                    }
                });
            }
            catch (err) {
                console.log("Couldn't obtain job " + id + " when parsing active jobs");
            }
        });
    });

    console.log("Removed lingering jobs from previous sessions");

    restart_queue();
}


queue.on('job error', function(id, err){
    console.log("Job error " + err + " with " + id);
    // There was a timeout of 3sec, reset the bots busy state

    // Find which bot was handling this request
    for(var x2 = 0; x2 < bot_number; x2++) {
        if (id == botData[x2]["childid"]) {
            // found the index of the bot, change the status
            console.log("Found bot to reset value " + x2);

            // Increment the failed attempt
            if (id in failedAttempts) {
                failedAttempts[id] += 1;
            }
            else {
                failedAttempts[id] = 1;
            }

            if (failedAttempts[id] == maxATTEMPTS) {

                // Clear up the attempt
                if (id in failedAttempts) {
                    delete failedAttempts[id];
                }

                // Tell the client
                try {
                    kue.Job.get(id, function (err, job) {
                        console.log("Failed Job " + id);
                        if (job["data"]["socketid"] != undefined) {
                            io.to(job["data"]["socketid"]).emit("errormessage", "We couldn't retrieve the item data, are you sure you inputted the correct inspect link?");
                            var socketip = io.sockets.connected[job["data"]["socketid"]].request.connection.remoteAddress;
                            if (socketip in apiObjs) {
                                delete apiObjs[socketip];
                            }
                        }
                        else if (job["data"]["request"] != undefined && job["data"]["request"] in apiObjs) {
                            // failed http request
                            apiObjs[job["data"]["request"]].status(500).json({
                                error: "Valve's servers didn't reply in time",
                                code: 4
                            });
                            delete apiObjs[job["data"]["request"]];
                        }

                    });
                }
                catch (err) {
                    console.log("Failed to get job data for the failed job");
                }
            }

            // Turns out that if you don't call "done", Kue thinks the bot is still occupied
            botData[x2]["doneobj"]();
            botData[x2]["busy"] = 0;
            botData[x2]["childid"] = -1;

            break;
        }
    }
});


/*
Restarts the queue
*/
function restart_queue() {
    /*
    kue job failed handlers
    */
    queue.process('floatlookup', bot_number, function(job, ctx, done){
        // try to find an open bot
        bot_found = null;
        bot_index = -1;

        for(var x = 0; x < bot_number; x++) {
            if (botData[x]["busy"] == 0 && botData[x]["ready"] == 1) {

                var bot_found = botData[x]["obj"];
                botData[x]["doneobj"] = done;

                botData[x]["childid"] = job.id;
                botData[x]["requested"] = new Date().getTime();
                botData[x]["busy"] = 1;

                var bot_index = x;

                break;
            }
        }

        if (bot_found != null) {
            // follow through with sending the request
            console.log("Sending request to " + bot_index + " with a job id of " + job.id);

            var data = job["data"];
            bot_found.send(['floatrequest', data, done]);
        }
        else {
            console.log("There is no bot to fullfill this request, they must be down.");
        }
    });
}

/*
    Returns a boolean as to whether the specified path is a directory and exists
*/
function isValidDir(path) {
    try {
        return fs.statSync(path).isDirectory();
    } catch (e) {
        return false;
    }
}

// If the sentry folder doesn't exist, create it
if (!isValidDir("sentry")) {
    console.log("Creating sentry directory");
    fs.mkdirSync("sentry");
}


// Login the bots
for (var x = 0; x < bot_number; x++) {
    botData[x]["obj"].send(["login"]);
}

process.once("SIGTERM", function(sig) {
    // Graceful shutdown of Kue
    queue.shutdown(5000, function(err) {
        console.log("Kue shutdown: ", err || "");
        process.exit(0);
    });
});
