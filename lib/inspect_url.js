class InspectURL {
    constructor() {
        const params = ["s", "a", "d", "m"];
        this.properParams = false;

    	if (arguments.length == 1 && typeof arguments[0] === "string") {
    		// parse the inspect link
    		this.parseLink(arguments[0]);
    	}
        else if (arguments.length == 1 && typeof arguments[0] === "object") {
            // parse object with the params
            let amt = 0;

            for (let param of params) {
                if (arguments[0][param] && typeof arguments[0][param] === "string" && arguments[0][param].length > 0) {
                    this[param] = arguments[0][param];
                    amt++;
                }
                else this[param] = "0";
            }

            if (amt === 3) this.parseLink(this.buildLink());
        }
    	else if (arguments.length == 4) {
            // parse each arg

            // Ensure each arg is a string
            for (let param in params) {
                if (typeof arguments[param] === "string") {
                    this[params[param]] = arguments[param];
                }
                else return;
            }

            this.parseLink(this.buildLink());
    	}
    }

    parseLink(link) {
        // Regex parse the url
        var groups = /steam:\/\/rungame\/730\/\d+\/[+ ]csgo_econ_action_preview ([SM])(\d+)A(\d+)D(\d+)/.exec(link);

        if (groups) {
            if (groups[1] === "S") {
                this.s = groups[2];
                this.m = "0";
            }
            else if (groups[1] === "M") {
                this.m = groups[2];
                this.s = "0";
            }

            this.a = groups[3];
            this.d = groups[4];

            this.properParams = true;
        }
    }

    getParams() {
        if (this.properParams) return {s: this.s, a: this.a, d: this.d, m: this.m};
        else return;
    }

    getLink() {
        if (this.properParams) return this.buildLink();
        else return;
    }

    buildLink() {
        if (!("a" in this && "d" in this && ("m" in this || "s" in this))) return;

        if (this.s === "0" && this.m) return "steam://rungame/730/76561202255233023/+csgo_econ_action_preview M" + this.m + "A" + this.a + "D" + this.d;
        else return "steam://rungame/730/76561202255233023/+csgo_econ_action_preview S" + this.s + "A" + this.a + "D" + this.d;
    }
}

module.exports = InspectURL;