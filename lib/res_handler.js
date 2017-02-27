const respondToUser = function (params, res_response, status_code, ws_code) {
    // Send back the data
    if (params.type === 'http') {
        if (!status_code) params.res.json(res_response);
        else params.res.status(status_code).json(res_response);
    }
    else if (params.type === 'ws') {
        if (!ws_code) ws_code = 'errormessage';

        params.res.emit(ws_code, res_response);
    }
};

exports.respondFloatToUser = function(params, res_response) {
    respondToUser(params, res_response, 200, 'floatmessage');
};

exports.respondErrorToUser = function(params, res_response, status_code) {
    respondToUser(params, res_response, status_code, 'errormessage');
};

exports.respondInfoToUser = function(params, res_response) {
    respondToUser(params, res_response, 200, 'infomessage');
};
