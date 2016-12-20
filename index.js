const fs = require("fs"),
    queue = require("kue").createQueue(),
    BotController = require("./bot_controller");

// Get the bot login info
const CONFIG = JSON.parse(fs.readFileSync("config.json", "utf8"));

if (CONFIG.logins.length == 0) {
    console.log("There are no bot logins. Please add some in config.json");
    process.exit(1);
}

const botController = new BotController();

for (let loginData of CONFIG.logins) {
    botController.addBot(loginData);
}

const createJob = function(data, saveCallback) {
    queue.create("floatlookup", data)
    .ttl(2000)
    .attempts(2)
    .removeOnComplete(true)
    .save(saveCallback);
};

botController.bots[0].readyToKickAss = () => {
    console.log("ready to kick ass")

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
}

queue.process("floatlookup", CONFIG.logins.length, (job, done) => {
    botController.lookupFloat(job.data)
    .then((floatValue) => {
        console.log("hi", floatValue);
        done();
    })
    .catch((err) => {
        done(err);
    });
})

process.once("SIGTERM", (sig) => {
    queue.shutdown(5000, (err) => {
        console.log("Kue shutdown: ", err || "");
        process.exit(0);
    });
});
