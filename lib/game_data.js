const   fs = require("fs"),
        vdf = require("simple-vdf"),
        https = require("https");

class GameData {
    constructor() {
        this.items_game_url = "https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/scripts/items/items_game.txt";
        this.items_game_cdn_url = "https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/scripts/items/items_game_cdn.txt";
        this.csgo_english_url = "https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/resource/csgo_english.txt";

        this.items_game = false;
        this.items_game_cdn = false;
        this.csgo_english = false;

        // Create the game data folder if it doesn't exist
        if (!GameData.isValidDir("game_files")) {
            console.log("Creating game files directory");
            fs.mkdirSync("game_files");
        }
        else {
            // check if we can load the files from disk
            this.loadFiles();
        }

        // Update the files
        this.update();
    }

    /*
        Loads items_game, csgo_english, and items_game_cdn from disk
    */
    loadFiles() {
        if (fs.existsSync("game_files/items_game.txt")) {
            this.items_game = vdf.parse(fs.readFileSync("game_files/items_game.txt", "utf8"));
        }

        if (fs.existsSync("game_files/csgo_english.txt")) {
            this.csgo_english = vdf.parse(fs.readFileSync("game_files/csgo_english.txt", "utf8"));
        }

        if (fs.existsSync("game_files/items_game_cdn.txt")) {
            let data = fs.readFileSync("game_files/items_game_cdn.txt", "utf8");
            this.parseItemsCDN(data);
        }
    }

    /*
        Parses the data of items_game_cdn
    */
    parseItemsCDN(data) {
        let lines = data.split("\n");

        this.items_game_cdn = {};

        for (let line of lines) {
            var kv = line.split("=");

            if (kv[1]) {
                this.items_game_cdn[kv[0]] = kv[1];
            }
        }
    }

    /*
        Downloads the given HTTPS file
    */
    downloadFile(url, cb) {
        https.get(url, function(res) {
            if (res.statusCode !== 200) {
                cb();
                return;
            }

            res.setEncoding("utf8");
            let data = "";

            res.on("data", function(chunk) { data += chunk; });

            res.on("end", function() {
                cb(data);
            })
        });
    }

    /*
        Updates and saves the most recent versions of csgo_english, items_game, and items_game_cdn from the SteamDB Github
    */
    update() {
        console.log("Updating Game Files...");

        this.downloadFile(this.items_game_url, (data) => {
            if (data) {
                console.log("Fetched items_game.txt");
                this.items_game = vdf.parse(data);
                fs.writeFileSync("game_files/items_game.txt", data, "utf8");
            }
            else console.log("Failed to fetch items_game.txt");
        });

        this.downloadFile(this.csgo_english_url, (data) => {
            if (data) {
                console.log("Fetched csgo_english.txt");
                this.csgo_english = vdf.parse(data);
                fs.writeFileSync("game_files/csgo_english.txt", data, "utf8");
            }
            else console.log("Failed to fetch csgo_english.txt");
        });

        this.downloadFile(this.items_game_cdn_url, (data) => {
            if (data) {
                console.log("Fetched items_game_cdn.txt");
                this.parseItemsCDN(data);
                fs.writeFileSync("game_files/items_game_cdn.txt", data, "utf8");
            }
            else console.log("Failed to fetch items_game_cdn.txt");
        });
    }

    /*
        Given returned iteminfo, finds the item's min/max float, name, weapon type, and image url using CSGO game data
    */
    addAdditionalItemProperties(iteminfo) {
        if (!this.items_game || !this.items_game_cdn || !this.csgo_english) return;

        // Get the skin name
        let skin_name = "";

        if (iteminfo.paintindex in this.items_game["items_game"]["paint_kits"]) {
            skin_name = "_" + this.items_game["items_game"]["paint_kits"][iteminfo.paintindex]["name"];

            if (skin_name == "_default") {
                skin_name = "";
            }
        }

        // Get the weapon name
        if (iteminfo.defindex in this.items_game["items_game"]["items"]) {
            var weapon_name = this.items_game["items_game"]["items"][iteminfo.defindex]["name"];
        }

        // Get the image url
        let image_name = weapon_name + skin_name;

        if (image_name in this.items_game_cdn) {
            iteminfo["imageurl"] = this.items_game_cdn[image_name]
        }


        let code_name = null;
        let paint_data = null;

        // Get the paint data and code name
        if (iteminfo.paintindex in this.items_game["items_game"]["paint_kits"]) {
            code_name = this.items_game["items_game"]["paint_kits"][iteminfo.paintindex]["description_tag"].replace("#", "");
            paint_data = this.items_game["items_game"]["paint_kits"][iteminfo.paintindex];
        }

        // Get the min float
        if (paint_data && 'wear_remap_min' in paint_data) {
            iteminfo["min"] = parseFloat(paint_data["wear_remap_min"]);
        }
        else {
            iteminfo["min"] = 0.06;
        }

        // Get the max float
        if (paint_data && 'wear_remap_max' in paint_data) {
            iteminfo["max"] = parseFloat(paint_data["wear_remap_max"]);
        }
        else {
            iteminfo["max"] = 0.8;
        }

        let weapon_data = "";

        if (iteminfo.defindex in this.items_game["items_game"]["items"]) {
            weapon_data = this.items_game["items_game"]["items"][iteminfo.defindex];
        }

        // Get the weapon_hud
        let weapon_hud = null;

        if (weapon_data !== "" && 'item_name' in weapon_data) {
            weapon_hud = weapon_data["item_name"].replace("#", "");
        }
        else {
            // need to find the weapon hud from the prefab
            if (iteminfo.defindex in this.items_game["items_game"]["items"]) {
                var prefabval = this.items_game["items_game"]["items"][iteminfo.defindex]["prefab"];
                weapon_hud = this.items_game["items_game"]["prefabs"][prefabval]["item_name"].replace("#", "");
            }
        }

        // Get the skin name if we can
        if (weapon_hud in this.csgo_english["lang"]["Tokens"] && code_name in this.csgo_english["lang"]["Tokens"]) {
            iteminfo["item_name"] = this.csgo_english["lang"]["Tokens"][weapon_hud];
            iteminfo["weapon_type"] = this.csgo_english["lang"]["Tokens"][code_name];
        }
    }

    /*
        Returns a boolean as to whether the specified path is a directory and exists
    */
    static isValidDir(path) {
        try {
            return fs.statSync(path).isDirectory();
        } catch (e) {
            return false;
        }
    }
}

module.exports = GameData;
