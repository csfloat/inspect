const fs = require("fs"),
    kue = require("kue"),
    queue = kue.createQueue(),
    BotController = require("./bot_controller"),
    InspectURL = require("./inspect_url"),
    ResController = require("./res_controller"),
    CONFIG = require("./config");

if (CONFIG.logins.length == 0) {
    console.log("There are no bot logins. Please add some in config.json");
    process.exit(1);
}

const botController = new BotController();
const resController = new ResController();

const errorMsgs = {
    1: "Improper Parameter Structure",
    2: "Invalid Inspect Link Structure",
    3: "You may only have one pending request at a time",
    4: "Valve's servers didn't reply in time",
    5: "Valve's servers appear to be offline, please try again later"
}

for (let loginData of CONFIG.logins) {
    botController.addBot(loginData, CONFIG.bot_settings);
}

const createJob = function(data, saveCallback) {
    queue.create("floatlookup", data)
    .ttl(CONFIG.bot_settings.request_ttl)
    .attempts(CONFIG.bot_settings.max_attempts)
    .removeOnComplete(true)
    .save(saveCallback);
};

botController.bots[0].exampleTest = () => {
    console.log("ready to kick ass");

    createJob({
        s: "0",
        a: "8449497752",
        d: "12421046574319460861",
        m: "784021865847461149"
    });

    createJob({
        s: "0",
        a: "8449500490",
        d: "14312561011969544059",
        m: "784021865847463229"
    });

    let testURL = new InspectURL("0", "8449500490", "14312561011969544059", "784021865847463229");
    console.log(testURL.getLink());

    let testURL2 = new InspectURL("steam://rungame/730/76561202255233023/+csgo_econ_action_preview S76561198084749846A698323590D7935523998312483177");
    console.log(testURL2.getParams());
}


// Setup and configure express
var app = require("express")();

app.get("/", function(req, res) {
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

    if ("url" in req.query) thisLink = new InspectURL(req.query.url);
    else if ("a" in req.query && "d" in req.query && ("s" in req.query || "m" in req.query)) thisLink = new InspectURL(req.query);

    // Make sure the params are valid
    if (!thisLink || !thisLink.getParams()) {
        res.status(400).json({error: errorMsgs[2], code: 2});
        return;
    }

    // Check if there is a bot online to process this request
    if (botController.isBotOnline()) {
        let userIP = req.connection.remoteAddress;
        let params = thisLink.getParams();

        params["ip"] = userIP;
        params["type"] = "http";

        // If the flag is set, check if the user already has a request in the queue
        if (CONFIG.allow_simultaneous_requests || !resController.isUserInQueue(userIP)) {
            resController.addUserRequest(userIP, res, params);
            createJob(params);
        }
        else {
            res.status(400).json({error: errorMsgs[3], code: 3});
        }
    }
    else {
        res.status(503).json({error: errorMsgs[5], code: 5});
    }
});

var http_server = require("http").Server(app);

var https_server;

if (CONFIG.https.enable) {
    var credentials = {
        key: fs.readFileSync(CONFIG.https.key_path, 'utf8'),
        cert: fs.readFileSync(CONFIG.https.cert_path, 'utf8'),
        ca: fs.readFileSync(CONFIG.https.ca_path, 'utf8')
    };

    https_server = require("https").Server(credentials, app);
}

if (CONFIG.http.enable) {
    http_server.listen(CONFIG.http.port);
    console.log("Listening for HTTP on port: " + CONFIG.http.port);
}

if (CONFIG.https.enable) {
    https_server.listen(CONFIG.https.port);
    console.log("Listening for HTTPS on port: " + CONFIG.https.port);
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
            console.log("Couldn't obtain job", id, "when parsing inactive jobs");
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
            console.log("Couldn't obtain job", id, "when parsing active jobs");
        }
    });
});

queue.process("floatlookup", CONFIG.logins.length, (job, done) => {
    botController.lookupFloat(job.data)
    .then((itemData) => {
        console.log("Recieved itemData: ", itemData);

        // Save and remove the delay attribute
        let delay = itemData.delay;
        delete itemData.delay;

        resController.respondToUser(job.data.ip, job.data, itemData);

        setTimeout(() => {
            done();
        }, delay);
    })
    .catch((err) => {
        resController.respondToUser(job.data.ip, job.data, {error: errorMsgs[4], code: 4}, 500);
        console.log("Job Error:", err);
        done(String(err));
    });
});

queue.on('job failed', function(id, result) {
    console.log("Job", id, "Failed!");
    try {
        kue.Job.get(id, function(err, job) {
            if (job != undefined) {
                resController.respondToUser(job.data.ip, job.data, {error: errorMsgs[4], code: 4}, 500);
                job.remove();
            }
        });
    }
    catch (err) {
        console.log("Couldn't obtain failed job", id);
    }
});

process.once("SIGTERM", (sig) => {
    queue.shutdown(5000, (err) => {
        console.log("Kue shutdown: ", err || "");
        process.exit(0);
    });
});
