const fs = require('fs'),
    winston = require('winston'),
    vdf = require('simple-vdf'),
    utils = require('./utils');

const floatNames = [{
    range: [0, 0.07],
    name: 'SFUI_InvTooltip_Wear_Amount_0'
},{
    range: [0.07, 0.15],
    name: 'SFUI_InvTooltip_Wear_Amount_1'
},{
    range: [0.15, 0.38],
    name: 'SFUI_InvTooltip_Wear_Amount_2'
},{
    range: [0.38, 0.45],
    name: 'SFUI_InvTooltip_Wear_Amount_3'
},{
    range: [0.45, 1.00],
    name: 'SFUI_InvTooltip_Wear_Amount_4'
}];


const LanguageHandler = {
    get: function(obj, prop) {
        return obj[prop.toLowerCase()];
    },
    has: function (obj, prop) {
        return prop.toLowerCase() in obj;
    }
};

class GameData {
    constructor(update_interval, enable_update) {
        this.items_game_url = 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/scripts/items/items_game.txt';
        this.items_game_cdn_url = 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/scripts/items/items_game_cdn.txt';
        this.csgo_english_url = 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/resource/csgo_english.txt';
        this.schema_url = 'https://raw.githubusercontent.com/SteamDatabase/SteamTracking/b5cba7a22ab899d6d423380cff21cec707b7c947/ItemSchema/CounterStrikeGlobalOffensive.json';

        this.items_game = false;
        this.items_game_cdn = false;
        this.csgo_english = false;
        this.schema = false;

        // Create the game data folder if it doesn't exist
        if (!utils.isValidDir('game_files')) {
            winston.info('Creating game files directory');
            fs.mkdirSync('game_files');
        }
        else {
            // check if we can load the files from disk
            this.loadFiles();
        }

        if (enable_update) {
            // Update the files
            this.update();

            // Setup interval
            if (update_interval && update_interval > 0) setInterval(() => {this.update();}, update_interval*1000);
        }
    }

    /*
        Loads items_game, csgo_english, and items_game_cdn from disk
    */
    loadFiles() {
        if (fs.existsSync('game_files/items_game.txt')) {
            this.items_game = vdf.parse(fs.readFileSync('game_files/items_game.txt', 'utf8'))['items_game'];
        }

        if (fs.existsSync('game_files/csgo_english.txt')) {
            const f = fs.readFileSync('game_files/csgo_english.txt', 'utf8');
            this.csgo_english = this.objectKeysToLowerCase(vdf.parse(f)['lang']['Tokens']);
            this.csgo_english = new Proxy(this.csgo_english, LanguageHandler);
        }

        if (fs.existsSync('game_files/items_game_cdn.txt')) {
            let data = fs.readFileSync('game_files/items_game_cdn.txt', 'utf8');
            this.items_game_cdn = this.parseItemsCDN(data);
        }

        if (fs.existsSync('game_files/schema.json')) {
            let data = fs.readFileSync('game_files/schema.json', 'utf8');
            this.schema = JSON.parse(data)['result'];
        }
    }

    /*
        Parses the data of items_game_cdn
    */
    parseItemsCDN(data) {
        let lines = data.split('\n');

        const result = {};

        for (let line of lines) {
            let kv = line.split('=');

            if (kv[1]) {
                result[kv[0]] = kv[1];
            }
        }

        return result;
    }

    /*
        Calls toLowerCase on all object shallow keys, modifies in-place, not pure
     */
    objectKeysToLowerCase(obj) {
        const keys = Object.keys(obj);
        let n = keys.length;
        while (n--) {
            const key = keys[n];
            const lower = key.toLowerCase();
            if (key !== lower) {
                obj[lower] = obj[key];
                delete obj[key];
            }
        }

        return obj
    }

    /*
        Updates and saves the most recent versions of csgo_english, items_game, and items_game_cdn from the SteamDB Github
    */
    update() {
        winston.info('Updating Game Files...');

        utils.downloadFile(this.items_game_url, (data) => {
            if (data) {
                winston.debug('Fetched items_game.txt');
                this.items_game = vdf.parse(data)['items_game'];
                fs.writeFileSync('game_files/items_game.txt', data, 'utf8');
            }
            else winston.error('Failed to fetch items_game.txt');
        });

        utils.downloadFile(this.csgo_english_url, (data) => {
            if (data) {
                winston.debug('Fetched csgo_english.txt');
                this.csgo_english = this.objectKeysToLowerCase(vdf.parse(data)['lang']['Tokens']);
                this.csgo_english = new Proxy(this.csgo_english, LanguageHandler);

                fs.writeFileSync('game_files/csgo_english.txt', data, 'utf8');
            }
            else winston.error('Failed to fetch csgo_english.txt');
        });

        utils.downloadFile(this.items_game_cdn_url, (data) => {
            if (data) {
                winston.debug('Fetched items_game_cdn.txt');
                this.items_game_cdn = this.parseItemsCDN(data);
                fs.writeFileSync('game_files/items_game_cdn.txt', data, 'utf8');
            }
            else winston.error('Failed to fetch items_game_cdn.txt');
        });

        utils.downloadFile(this.schema_url, (data) => {
            if (data) {
                winston.debug('Fetched schema.json');
                this.schema = JSON.parse(data)['result'];
                fs.writeFileSync('game_files/schema.json', data, 'utf8');
            }
            else winston.error('Failed to fetch schema.json');
        });
    }

    /*
        Given returned iteminfo, finds the item's min/max float, name, weapon type, and image url using CSGO game data
    */
    addAdditionalItemProperties(iteminfo) {
        if (!this.items_game || !this.items_game_cdn || !this.csgo_english) return;

        // Get sticker codename/name
        const stickerKits = this.items_game.sticker_kits;
        for (const sticker of iteminfo.stickers) {
            const kit = stickerKits[sticker.stickerId];

            if (!kit) continue;

            sticker.codename = kit.name;

            let name = this.csgo_english[kit.item_name.replace('#', '')];

            if (sticker.tintId) {
                name += ` (${this.csgo_english[`Attrib_SprayTintValue_${sticker.tintId}`]})`;
            }

            if (name) sticker.name = name;
        }

        // Get the skin name
        let skin_name = '';

        if (iteminfo.paintindex in this.items_game['paint_kits']) {
            skin_name = '_' + this.items_game['paint_kits'][iteminfo.paintindex]['name'];

            if (skin_name == '_default') {
                skin_name = '';
            }
        }

        // Get the weapon name
        let weapon_name;

        if (iteminfo.defindex in this.items_game['items']) {
            weapon_name = this.items_game['items'][iteminfo.defindex]['name'];
        }

        // Get the image url
        let image_name = weapon_name + skin_name;

        if (image_name in this.items_game_cdn) {
            iteminfo['imageurl'] = this.items_game_cdn[image_name];
        }

        // Get the paint data and code name
        let code_name;
        let paint_data;

        if (iteminfo.paintindex in this.items_game['paint_kits']) {
            code_name = this.items_game['paint_kits'][iteminfo.paintindex]['description_tag'].replace('#', '');
            paint_data = this.items_game['paint_kits'][iteminfo.paintindex];
        }

        // Get the min float
        if (paint_data && 'wear_remap_min' in paint_data) {
            iteminfo['min'] = parseFloat(paint_data['wear_remap_min']);
        }
        else iteminfo['min'] = 0.06;

        // Get the max float
        if (paint_data && 'wear_remap_max' in paint_data) {
            iteminfo['max'] = parseFloat(paint_data['wear_remap_max']);
        }
        else iteminfo['max'] = 0.8;

        let weapon_data = '';

        if (iteminfo.defindex in this.items_game['items']) {
            weapon_data = this.items_game['items'][iteminfo.defindex];
        }

        // Get the weapon_hud
        let weapon_hud;

        if (weapon_data !== '' && 'item_name' in weapon_data) {
            weapon_hud = weapon_data['item_name'].replace('#', '');
        }
        else {
            // need to find the weapon hud from the prefab
            if (iteminfo.defindex in this.items_game['items']) {
                let prefab_val = this.items_game['items'][iteminfo.defindex]['prefab'];
                weapon_hud = this.items_game['prefabs'][prefab_val]['item_name'].replace('#', '');
            }
        }

        // Get the skin name if we can
        if (weapon_hud in this.csgo_english && code_name in this.csgo_english) {
            iteminfo['weapon_type'] = this.csgo_english[weapon_hud];
            iteminfo['item_name'] = this.csgo_english[code_name];
        }

        // Get the rarity name (Mil-Spec Grade, Covert etc...)
        const rarityKey = Object.keys(this.items_game['rarities']).find((key) => {
            return parseInt(this.items_game['rarities'][key]['value']) === iteminfo.rarity;
        });

        if (rarityKey) {
            const rarity = this.items_game['rarities'][rarityKey];

            // Assumes weapons always have a float above 0 and that other items don't
            // TODO: Improve weapon check if this isn't robust
            iteminfo['rarity_name'] = this.csgo_english
                [rarity[iteminfo.floatvalue > 0 ? 'loc_key_weapon' : 'loc_key']];
        }

        // Get the quality name (Souvenir, Stattrak, etc...)
        const qualityKey = Object.keys(this.items_game['qualities']).find((key) => {
            return parseInt(this.items_game['qualities'][key]['value']) === iteminfo.quality;
        });

        iteminfo['quality_name'] = this.csgo_english[qualityKey];

        // Get the origin name
        const origin = this.schema['originNames'].find((o) => o.origin === iteminfo.origin);

        if (origin) {
            iteminfo['origin_name'] = origin['name'];
        }

        // Get the wear name
        const wearName = this.getWearName(iteminfo.floatvalue);
        if (wearName) {
            iteminfo['wear_name'] = wearName;
        }

        const itemName = this.getFullItemName(iteminfo);
        if (itemName) {
            iteminfo['full_item_name'] = itemName;
        }
    }

    getWearName(float) {
        const f = floatNames.find((f) => float > f.range[0] && float <= f.range[1]);

        if (f) {
            return this.csgo_english[f['name']];
        }
    }

    getFullItemName(iteminfo) {
        let name = '';

        // Default items have the "unique" quality
        if (iteminfo.quality !== 4) {
            name += `${iteminfo.quality_name} `;
        }

        // Patch for items that are stattrak and unusual (ex. Stattrak Karambit)
        if (iteminfo.killeatervalue !== null && iteminfo.quality !== 9) {
            name += `${this.csgo_english['strange']} `;
        }

        name += `${iteminfo.weapon_type} `;

        if (iteminfo.weapon_type === 'Sticker' || iteminfo.weapon_type === 'Sealed Graffiti') {
            name += `| ${iteminfo.stickers[0].name}`;
        }

        // Vanilla items have an item_name of '-'
        if (iteminfo.item_name && iteminfo.item_name !== '-') {
            name += `| ${iteminfo.item_name} `;

            if (iteminfo.wear_name) {
                name += `(${iteminfo.wear_name})`;
            }
        }

        return name.trim();
    }
}

module.exports = GameData;
