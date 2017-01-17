class ResController {
    constructor() {
        this.userResponses = {};
    }

    addUserRequest(params) {
        params = Object.assign({}, params);

        if (this.userResponses[params.ip] === undefined) this.userResponses[params.ip] = [];

        this.userResponses[params.ip].push(params);
    }

    respondToUser(ip, params, res_response, status_code) {
        if (this.userResponses[ip] === undefined) return;

        for (let response in this.userResponses[ip]) {
            let this_response = this.userResponses[ip][response];

            // check if each param is the same
            for (let param in params) {
                if (params[param] != this_response[param]) continue;
            }

            // Send back the data
            if (params.type == "http") {
                if (!status_code) this.userResponses[ip][response]["res"].json(res_response);
                else this.userResponses[ip][response]["res"].status(status_code).json(res_response);
            }
            else if (params.type == "ws") {
                this.userResponses[ip][response]["res"].emit('floatmessage', res_response);
            }

            // Remove the request
            this.userResponses[ip].splice(response, 1);

            break;
        }
    }

    isUserInQueue(ip) {
        if (this.userResponses[ip] === undefined || this.userResponses[ip].length == 0) return false;
        else return true;
    }
}

module.exports = ResController;
