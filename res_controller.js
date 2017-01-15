class ResController {
    constructor() {
        this.userResponses = {};
    }

    addUserRequest(ip, res, params) {
        params = Object.assign({}, params);

        if (this.userResponses[ip] === undefined) this.userResponses[ip] = [];

        params["res"] = res;

        this.userResponses[ip].push(Object.assign({}, params));
    }

    respondToUser(ip, params, res_response, status_code) {
        if (this.userResponses[ip] === undefined) return;

        for (let response in this.userResponses[ip]) {
            let this_response = this.userResponses[ip][response];

            // check if each param is the same
            for (let param in params) {
                if (params[param] != this_response[param]) continue;
            }

            // send back the data
            if (!status_code) this.userResponses[ip][response]["res"].json(res_response);
            else this.userResponses[ip][response]["res"].status(status_code).json(res_response);

            // Remove the request
            this.userResponses[ip].splice(response, 1);

            break;
        }
    }

    isUserRequesting(ip) {
        if (this.userResponses[ip] === undefined || this.userResponses[ip].length == 0) return false;
        else return true;
    }
}

module.exports = ResController;
