class ResController {
    constructor() {
        this.userResponses = {};
    }

    addUserRequest(params) {
        params = Object.assign({}, params);

        if (this.userResponses[params.ip] === undefined) this.userResponses[params.ip] = [];

        this.userResponses[params.ip].push(params);
    }

    getUserResponseIndex(ip, params) {
        if (this.userResponses[ip] === undefined) return -1;

        // Find the request in our array
        return this.userResponses[ip].findIndex((item) => {
            for (let param in params) {
                if (params[param] != item[param]) return false;
            }

            return true;
        });
    }

    getJobAttempts(ip, params) {
        let responseIndex = this.getUserResponseIndex(ip, params);

        // If we don't have the response index, return
        if (responseIndex === -1) return;

        let attempts = this.userResponses[ip][responseIndex]['attempts'];

        if (!attempts) attempts = 0;

        return attempts;
    }

    incrementJobAttempts(ip, params) {
        let responseIndex = this.getUserResponseIndex(ip, params);

        // If we don't have the response index, return
        if (responseIndex === -1) return;

        let job = this.userResponses[ip][responseIndex];

        if (!job.attempts) job.attempts = 1;
        else job.attempts++;

        return job.attempts;
    }

    insertJobDoneObj(ip, params, done) {
        let responseIndex = this.getUserResponseIndex(ip, params);

        // If we don't have the response index, return
        if (responseIndex === -1) return;

        this.userResponses[ip][responseIndex]['done'] = done;
    }

    callJobDoneObj(ip, params) {
        let responseIndex = this.getUserResponseIndex(ip, params);

        // If we don't have the response index, return
        if (responseIndex === -1) {
            console.log(`Failed to retrieve response index for done obj ${params}`);
            return;
        }

        let done = this.userResponses[ip][responseIndex]['done'];

        if (done) done();
        else console.log(`Failed to obtain done obj for ${params}`);
    }

    respondFloatToUser(ip, params, res_response, ws_remove) {
        // If they didn't set ws_remove, default to true
        if (ws_remove === undefined) ws_remove = true;

        this.respondToUser(ip, params, res_response, 200, 'floatmessage', ws_remove);
    }

    respondErrorToUser(ip, params, res_response, status_code, ws_remove) {
        // If they didn't set ws_remove, default to true
        if (ws_remove === undefined) ws_remove = true;

        this.respondToUser(ip, params, res_response, status_code, 'errormessage', ws_remove);
    }

    respondInfoToUser(ip, params, res_response, ws_remove) {
        this.respondToUser(ip, params, res_response, 200, 'infomessage', ws_remove);
    }

    respondToUser(ip, params, res_response, status_code, ws_code, ws_remove) {
        // Get the response object
        let responseIndex = this.getUserResponseIndex(ip, params);

        // If we don't have the response index, return
        if (responseIndex === -1) return;

        let res = this.userResponses[ip][responseIndex]['res'];

        // Send back the data
        if (params.type === 'http') {
            if (!status_code) res.json(res_response);
            else res.status(status_code).json(res_response);
        }
        else if (params.type === 'ws') {
            if (!ws_code) ws_code = 'errormessage';

            res.emit(ws_code, res_response);
        }

        // Remove the request if it is HTTP or requested for a WebSocket user
        if (params.type === 'http' || ws_remove) {
            this.userResponses[ip].splice(responseIndex, 1);
        }
    }

    isUserInQueue(ip) {
        return (this.userResponses[ip] !== undefined && this.userResponses[ip].length > 0);
    }
}

module.exports = ResController;
