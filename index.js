const fs = require("fs"),
    kue = require("kue"),
    queue = kue.createQueue(),
    BotController = require("./bot_controller"),
    InspectURL = require("./inspect_url"),
    CONFIG = require("./config");

if (CONFIG.logins.length == 0) {
    console.log("There are no bot logins. Please add some in config.json");
    process.exit(1);
}

const botController = new BotController();

for (let loginData of CONFIG.logins) {
    botController.addBot(loginData, CONFIG.bot_settings);
}

const createJob = function(data, saveCallback) {
    queue.create("floatlookup", data)
    .ttl(CONFIG.bot_settings.request_ttl)
    .attempts(2)
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

queue.process("floatlookup", CONFIG.logins.length, (job, done) => {
    botController.lookupFloat(job.data)
    .then((itemData) => {
        console.log("Recieved itemData: ", itemData);

        setTimeout(() => {
            done();
        }, itemData.delay);
    })
    .catch((err) => {
        console.log("Job Error: " + err);
        done(String(err));
    });
});

queue.on('job failed attempt', function(id, result){
    console.log("Job", id, "Failed Attempt!");
});

queue.on('job failed', function(id, result){
    console.log("Job", id, "Failed!");
});

process.once("SIGTERM", (sig) => {
    queue.shutdown(5000, (err) => {
        console.log("Kue shutdown: ", err || "");
        process.exit(0);
    });
});
