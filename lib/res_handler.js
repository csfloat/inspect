class ResHandler {
    static respondFloatToUser(params, res_response) {
        ResHandler.respondToUser(params, res_response, 200, 'floatmessage');
    }

    static respondErrorToUser(params, res_response, status_code) {
        ResHandler.respondToUser(params, res_response, status_code, 'errormessage');
    }

    static respondInfoToUser(params, res_response) {
        ResHandler.respondToUser(params, res_response, 200, 'infomessage');
    }

    static respondToUser(params, res_response, status_code, ws_code) {
        // Send back the data
        if (params.type === 'http') {
            if (!status_code) params.res.json(res_response);
            else params.res.status(status_code).json(res_response);
        }
        else if (params.type === 'ws') {
            if (!ws_code) ws_code = 'errormessage';

            params.res.emit(ws_code, res_response);
        }
    }
}

module.exports = ResHandler;
