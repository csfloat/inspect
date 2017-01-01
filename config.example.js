module.exports = {
    // Configuration for the HTTP API server
    "http": {
        "enable": true,
        "port": 1739
    },
    // Configuration for the HTTPS API server
    "https": {
        "enable": false,
        "port": 1738,
        "key_path": "certs/sslnopass.key",
        "cert_path": "certs/api.example.com.crt",
        "ca_path": "certs/example.cer"
    },
    // Configuration for the socket.io server
    "socketio": {
        "enable": false,
        "origins": "example.com:80"
    },
    // List of usernames and passwords for the Steam accounts
    "logins": [
        {
            "user": "USERNAME",
            "pass": "PASSWORD",
            "auth": "2FA_TOKEN"
        },
        {
            "user": "USERNAME_2",
            "pass": "PASSWORD_2",
            "auth": "2FA_TOKEN_2"
        }
    ],
    // Amount of attempts for each request to Valve
    "max_attempts": 1,
    // Amount of milliseconds to wait between subsequent requests to Valve (per bot)
    "request_delay": 1100,
    // Origins allowed to connect to the HTTP/HTTPS API
    "allowed_origins": [
        "http://example.com",
        "https://example.com",
        "chrome-extension://jjicbefpemnphinccgikpdaagjebbnhg",
        "http://steamcommunity.com",
        "https://steamcommunity.com"
    ],
    // MongoDB connection info
    "database": {
        "url": "localhost",
        "port": 27017
    }
}
