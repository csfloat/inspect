const utils = require('./utils');

class InspectURL {
    constructor() {
        this.requiredParams = ['s', 'a', 'd', 'm'];

        if (arguments.length == 1 && typeof arguments[0] === 'string') {
            // parse the inspect link
            this.parseLink(arguments[0]);
        }
        else if (arguments.length == 1 && typeof arguments[0] === 'object') {
            // parse object with the requiredParams

            for (let param of this.requiredParams) {
                if (arguments[0][param] && typeof arguments[0][param] === 'string' && arguments[0][param].length > 0) {
                    this[param] = arguments[0][param];
                }
                else this[param] = '0';
            }
        }
        else if (arguments.length == 4) {
            // parse each arg

            // Ensure each arg is a string
            for (let param in this.requiredParams) {
                if (typeof arguments[param] === 'string') {
                    this[this.requiredParams[param]] = arguments[param];
                }
                else return;
            }
        }
    }

    get valid() {
        // Ensure each param exists and only contains digits
        for (let param of this.requiredParams) {
            if (!this[param] || !utils.isOnlyDigits(this[param])) return false;
        }

        return true;
    }

    parseLink(link) {
        // Regex parse the url
        let groups = /^steam:\/\/rungame\/730\/\d+\/[+ ]csgo_econ_action_preview ([SM])(\d+)A(\d+)D(\d+)$/.exec(link);

        if (groups) {
            if (groups[1] === 'S') {
                this.s = groups[2];
                this.m = '0';
            }
            else if (groups[1] === 'M') {
                this.m = groups[2];
                this.s = '0';
            }

            this.a = groups[3];
            this.d = groups[4];
        }
    }

    getParams() {
        if (this.valid) return {s: this.s, a: this.a, d: this.d, m: this.m};
    }

    getLink() {
        if (!this.valid) return;

        if (this.s === '0' && this.m) {
            return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview M${this.m}A${this.a}D${this.d}`;
        }
        else {
            return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview S${this.s}A${this.a}D${this.d}`;
        }
    }
}

module.exports = InspectURL;