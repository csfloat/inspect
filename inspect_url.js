/*
Returns s, m, a, d parameters given an inspect link
*/
exports.parse = function(link) {
    if (!link) { return; }

    // For the API, + signs get converted to a space in Express, so we account for that
	var regexed = link.match(/steam:\/\/rungame\/730\/\d+\/[+ ]csgo_econ_action_preview [SM]\d+[A]\d+[D]\d+/g);

    // Return variable
    var returnVars;

    if (regexed != null && regexed[0] == link) {
        // the string still appears to be a valid structure
        // check whether it is a market or inventory request
        var lookup_type = link.match(/[+ ]csgo_econ_action_preview (.)\d*/);

        if (lookup_type[1] != null) {
            // get the data of the individual vars of the lookup string
            var variable_type = link.match(/[MS](.*)A/);
            var a = link.match(/[A](.*)D/);
            var d = link.match(/[D](.*)/);

            if (typeof variable_type[1] == "string" && typeof a[1] == "string" && typeof d[1] == "string") {
                // Verify that we are dealing with strings
                var svar = "0";
                var mvar = "0";
                var dvar = d[1];
                var avar = a[1];

                // Process whether this is from a market or inventory item
                if (lookup_type[1] == "M") {
                    mvar = variable_type[1];
                }
                else {
                    svar = variable_type[1];
                }

                // Overwrite the return val
                returnVars = { "s": svar, "a": avar, "d": dvar, "m": mvar };
            }
        }
    }

    return returnVars;
}

/*
Returns an inspect url given the params
*/
exports.build = function(params) {
    if (!(params && "a" in params && "d" in params && ("m" in params || "s" in params))) { return; }

	var url = ""

    if (!("s" in params) || params.s == "0") {
        url = "steam://rungame/730/76561202255233023/+csgo_econ_action_preview M" + params.m + "A" + params.a + "D" + params.d;
    }
    else {
        url = "steam://rungame/730/76561202255233023/+csgo_econ_action_preview S" + params.s + "A" + params.a + "D" + params.d;
    }

    return url;
}
