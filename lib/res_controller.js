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

        // Find the request in our array
        let responseIndex = this.userResponses[ip].findIndex((item) => {
            for (let param in params) {
                if (params[param] != item[param]) return false;
            }

            return true;
        });

        // If we didn't find the request, return
        if (responseIndex === -1) return;

        // Get the response object
        let res = this.userResponses[ip][responseIndex]['res'];

        // Send back the data
        if (params.type == 'http') {
            if (!status_code) res.json(res_response);
            else res.status(status_code).json(res_response);
        }
        else if (params.type == 'ws') {
            res.emit('floatmessage', res_response);
        }

        // Remove the request
        this.userResponses[ip].splice(responseIndex, 1);
    }

    isUserInQueue(ip) {
        if (this.userResponses[ip] === undefined || this.userResponses[ip].length == 0) return false;
        else return true;
    }
}

module.exports = ResController;
