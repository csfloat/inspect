class InspectURL {
    constructor() {
        this.properParams = false;

    	if (arguments.length == 1) {
    		// parse the inspect link
    		this.parseLink(arguments[0]);
    	}
    	else if (arguments.length == 4) {
            this.s = arguments[0];
            this.a = arguments[1];
            this.d = arguments[2];
            this.m = arguments[3];

            this.properParams = true;
    	}
    }

    parseLink(link) {
        // Regex parse the url
        var groups = /steam:\/\/rungame\/730\/\d+\/[+ ]csgo_econ_action_preview ([SM])(\d+)A(\d+)D(\d+)/.exec(link);

        if (groups) {
            if (groups[1] == "S") {
                this.s = groups[2];
                this.m = "0";
            }
            else if (groups[1] == "M") {
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
        if (!this.properParams) return;

        if (this.s == "0") return "steam://rungame/730/76561202255233023/+csgo_econ_action_preview M" + this.m + "A" + this.a + "D" + this.d;
        else return "steam://rungame/730/76561202255233023/+csgo_econ_action_preview S" + this.s + "A" + this.a + "D" + this.d;
    }
}

module.exports = InspectURL;