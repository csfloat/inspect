var Steam = require("steam"),
    util = require("util"),
    fs = require("fs"),
    csgo = require("csgo"),
    bot = new Steam.SteamClient(),
    steamUser = new Steam.SteamUser(bot),
    steamFriends = new Steam.SteamFriends(bot),
    steamGC = new Steam.SteamGameCoordinator(bot, 730);
    CSGOCli = new csgo.CSGOClient(steamUser, steamGC, false),
    crypto = require("crypto"),
    Long = require("long"),
    parse_vdf = require("vdf");

var login_info = JSON.parse(process.argv[2]); // obtain login info
var jobdata = {}; // Dict containing data about the current job
var weapon_images = {}; // Dict containing weapon images
var items_game_parsed = {}; // Dict containing a VDF parsed CSGO items_game copy
var csgo_english = {}; // Dict containing a VDF parsed CSGO csgo_english copy

// Parse items_game_cdn
try {
    var weapon_image_file = fs.readFileSync(__dirname + "/gamefiles/items_game_cdn.txt");
    var weapon_image_text = weapon_image_file.toString();
    var data = weapon_image_text.split("\r\n");
    for (var line in data) {
        var text_line = data[line];
        if (String(text_line).search("=") > -1) {
            image_data = text_line.split("=");
            weapon_images[image_data[0]] = image_data[1];
        }
    }
} catch (e) {
    console.error("File items_game_cdn.txt not found or is invalid: " + e.message);
    process.exit(1);
}

// Parse items_game file
fs.readFile('gamefiles/items_game.txt', 'utf8', function(err, contents) {
    if (err) {
        throw err;
    }
    // Parse the VDF file
    items_game_parsed = parse_vdf.parse(contents);
});

// Parse csgo_english file
fs.readFile('gamefiles/csgo_english.txt', {encoding: 'utf-8'}, function(err, contents) {
    // Parse the VDF file
    if (err) {
        throw err;
    }
    csgo_english = parse_vdf.parse(contents);
});

// Handle child-parent communications
process.on('message', function(m) {
    if (m[0] == "login") {
        bot.connect();
    }
    else if (m[0] == "floatrequest") {
        // Got a float request
        jobdata = m[1];
        jobdata["done"] = m[2];

        CSGOCli.itemDataRequest(jobdata["s"], jobdata["a"], jobdata["d"], jobdata["m"]);
    }
});

/*
    Emit message to the current websocket client for this request
*/
function emitMessage(type, msg) {
    process.send(["genericmsg", type, msg, jobdata["socketid"]]);
}

/*
    Parse and find the itemname from Valve's response
*/
function parseItemData(itemdata) {
    var parsed_json = JSON.parse(JSON.stringify(itemdata, null, 2));

    var wear_val = parsed_json.iteminfo.paintwear

    var long_itemid = parsed_json.iteminfo.itemid;
    var itemid = new Long(long_itemid.low, long_itemid.high, long_itemid.unsigned).toInt();

    // Get the item name
    if (parsed_json.iteminfo.paintindex in items_game_parsed["items_game"]["paint_kits"]) {
        var skin_name = "_" + items_game_parsed["items_game"]["paint_kits"][parsed_json.iteminfo.paintindex]["name"];
        if (skin_name == "_default") {
            skin_name = "";
        }
    }
    else {
        var skin_name = "";
    }

    if (parsed_json.iteminfo.defindex in items_game_parsed["items_game"]["items"]) {
        var weapon_name = items_game_parsed["items_game"]["items"][parsed_json.iteminfo.defindex]["name"];
    }

    var image_name = weapon_name + skin_name;

    if (image_name in weapon_images) {
        parsed_json["iteminfo"]["imageurl"] = weapon_images[image_name]
    }
    else {
        parsed_json["iteminfo"]["imageurl"] = null
    }

    if (parsed_json.iteminfo.paintindex in items_game_parsed["items_game"]["paint_kits"]) {
        var codename = items_game_parsed["items_game"]["paint_kits"][parsed_json.iteminfo.paintindex]["description_tag"].replace("#", "");
        var paint_data = items_game_parsed["items_game"]["paint_kits"][parsed_json.iteminfo.paintindex];
    }
    else {
        var codename = null;
        var paint_data = null;
    }

    if (paint_data != null && 'wear_remap_min' in paint_data) {
        parsed_json["iteminfo"]["min"] = parseFloat(paint_data["wear_remap_min"]);
    }
    else {
        parsed_json["iteminfo"]["min"] = 0.060000;
    }

    if (paint_data != null && 'wear_remap_max' in paint_data) {
        parsed_json["iteminfo"]["max"] = parseFloat(paint_data["wear_remap_max"]);
    }
    else {
        parsed_json["iteminfo"]["max"] = 0.800000;
    }

    if (parsed_json.iteminfo.defindex in items_game_parsed["items_game"]["items"]) {
        var weapon_data = items_game_parsed["items_game"]["items"][parsed_json.iteminfo.defindex];
    }
    else {
        var weapon_data = "";
    }

    var weapon_hud = null;
    if (weapon_data != "" && 'item_name' in weapon_data) {
        // don't have to get the wpnhud data
        weapon_hud = weapon_data["item_name"].replace("#", "");
    }
    else {
        // need to find the item_name from the prefab
        if (parsed_json.iteminfo.defindex in items_game_parsed["items_game"]["items"]) {
            var prefabval = items_game_parsed["items_game"]["items"][parsed_json.iteminfo.defindex]["prefab"];
            weapon_hud = items_game_parsed["items_game"]["prefabs"][prefabval]["item_name"].replace("#", "");
        }

    }

    if (weapon_hud in csgo_english["lang"]["Tokens"] && codename in csgo_english["lang"]["Tokens"]) {
        var weapon_type = csgo_english["lang"]["Tokens"][weapon_hud];
        var item_name = csgo_english["lang"]["Tokens"][codename];
    }

    parsed_json["iteminfo"]["itemid_int"] = itemid;
    parsed_json["iteminfo"]["item_name"] = item_name;

    parsed_json["iteminfo"]["paintindex"] = parsed_json.iteminfo.paintindex;
    parsed_json["iteminfo"]["defindex"] = parsed_json.iteminfo.defindex;

    parsed_json["iteminfo"]["s"] = jobdata["s"];
    parsed_json["iteminfo"]["a"] = jobdata["a"];
    parsed_json["iteminfo"]["d"] = jobdata["d"];
    parsed_json["iteminfo"]["m"] = jobdata["m"];

    parsed_json["iteminfo"]["weapon_type"] = weapon_type;

    emitItemData(parsed_json);
}

/*
    Send back itemdata to the parent
*/
function emitItemData(itemData) {
    process.send(["itemdata", login_info["index"], jobdata["socketid"], itemData, jobdata["request"]]);
}


function MakeSha(bytes) {
    var hash = crypto.createHash('sha1');
    hash.update(bytes);
    return hash.digest();
}


// CSGO Event Handlers
CSGOCli.on("unhandled", function(message) {
    util.log("Unhandled msg");
    util.log(message);
});


CSGOCli.on("ready", function() {
    util.log("node-csgo ready.");

    process.send(["ready", login_info["index"]]);
});


CSGOCli.on("itemData", function(itemdata) {
    parseItemData(itemdata);
});


CSGOCli.on("unready", function onUnready(){
    util.log("node-csgo unready.");
    process.send(["unready", login_info["index"]]);
});


CSGOCli.on("unhandled", function(kMsg) {
    util.log("UNHANDLED MESSAGE " + kMsg);
});

var logOnDetails = {
    "account_name": login_info["user"],
    "password": login_info["pass"],
};


if (login_info["auth"] != "") {
    logOnDetails.auth_code = login_info["auth"];
}

var sentry_path = "sentry/" + login_info["user"] + ".sentry";

console.log("Starting bot " + login_info["index"] + " with sentry id of " + sentry_path);

var sentry = null;

if (fs.existsSync(sentry_path)) {
    sentry = fs.readFileSync(sentry_path);
}
else {
    console.log("There is no sentry file for this bot");
}

if (sentry != undefined && sentry.length) {
    logOnDetails.sha_sentryfile = MakeSha(sentry);
}


// Steam Event Handler
steamUser.on("updateMachineAuth", function(response, callback){
    // One sentry file can store the login info for 3 bots, so we need to make multiple copies
    fs.writeFileSync(sentry_path, response.bytes);
    callback({ sha_file: MakeSha(response.bytes) });
});

bot.on("logOnResponse", function(response) {
    if (response.eresult == Steam.EResult.OK) {
        util.log('Logged in!');

        steamFriends.setPersonaState(Steam.EPersonaState.Busy);

        util.log("Current SteamID64: " + bot.steamID);
        util.log("Account ID: " + CSGOCli.ToAccountID(bot.steamID));

        CSGOCli.launch();
    }
    else {
        util.log("Error logging in " + login_info["user"], response);

        var login_error_msgs = {
            61: "Invalid Password",
            63: "Account login denied due to 2nd factor authentication failure. If using email auth, an email has been sent.",
            65: "Account login denied due to auth code being invalid",
            66: "Account login denied due to 2nd factor auth failure and no mail has been sent"
        };

        if (response.eresult && login_error_msgs[response.eresult] != undefined) {
            console.log(login_info["user"] + ": " + login_error_msgs[response.eresult]);
        }

        process.send(["unready", login_info["index"]]);
    }
});

bot.on("sentry", function(sentry) {
    util.log("Received sentry.");
    fs.writeFileSync("sentry", sentry);
});

bot.on("servers", function(servers) {
    util.log("Received servers.");
    fs.writeFile("servers.json", JSON.stringify(servers, null, 2));
});

bot.on("error", function() {
    // log on again
    process.send(["unready", login_info["index"]]);
});

bot.on("loggedOff", function() {
    // log on again
    process.send(["unready", login_info["index"]]);
});

bot.on("connected", function(){
    steamUser.logOn(logOnDetails);
});
