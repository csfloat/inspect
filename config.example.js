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
    // Whether to trust a forwarding proxy's IP (trust X-Forwarded-For)
    "trust_proxy": false,
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
            // You can either use a 2FA email/mobile token (5 letters/digits), or the shared_secret of mobile 2FA
            "auth": "2FA_TOKEN",
            // OPTIONAL: Bool to show its playing CS:GO (Default: true)
            "show_in_game": true
        },
        {
            "user": "USERNAME_2",
            "pass": "PASSWORD_2",
            "auth": "2FA_TOKEN_2"
        }
    ],
    // Bot settings
    "bot_settings": {
        // Amount of attempts for each request to Valve
        "max_attempts": 1,
        // Amount of milliseconds to wait between subsequent requests to Valve (per bot)
        "request_delay": 1100,
        // Amount of milliseconds to wait until a request to Valve is timed out
        "request_ttl": 2000
    },
    // Origins allowed to connect to the HTTP/HTTPS API
    "allowed_origins": [
        "http://example.com",
        "https://example.com",
        "chrome-extension://jjicbefpemnphinccgikpdaagjebbnhg",
        "http://steamcommunity.com",
        "https://steamcommunity.com"
    ],
    // Origins allowed to connect to the HTTP/HTTPS API with Regex
    "allowed_regex_origins": [
        "https://.*\\.steamcommunity\\.com"
    ],
    // Logging Level (error, warn, info, verbose, debug, silly)
    "logLevel": "debug",
    // Bool to Allow Simultaneous Requests to the API from the same IP (WS and HTTP/HTTPS)
    "allow_simultaneous_requests": false,
    // Bool to enable game file updates from the SteamDB Github tracker (updated item definitions, images, names)
    "enable_game_file_updates": true,
    // Amount of seconds to wait between updating game files (0 = No Interval Updates)
    "game_files_update_interval": 3600,
    // OPTIONAL: MongoDB connection info to store results in
    "database_url": "mongodb://localhost:27017/CSGOFloatdb"
};
