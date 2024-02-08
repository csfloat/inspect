require("dotenv").config();

module.exports = {
  // Configuration for the HTTP API server
  http: {
    port: 80,
  },
  // Whether to trust a forwarding proxy's IP (trust X-Forwarded-For)
  trust_proxy: false,
  // Bot settings
  bot_settings: {
    // Amount of attempts for each request to Valve
    max_attempts: 1,
    // Amount of milliseconds to wait between subsequent requests to Valve (per bot)
    request_delay: 1100,
    // Amount of milliseconds to wait until a request to Valve is timed out
    request_ttl: 2000,
    // OPTIONAL: Settings for Steam User (https://github.com/DoctorMcKay/node-steam-user#options-)
    steam_user: {},
  },
  // Origins allowed to connect to the HTTP/HTTPS API
  allowed_origins: [
    "chrome-extension://jjicbefpemnphinccgikpdaagjebbnhg",
    "http://steamcommunity.com",
    "https://steamcommunity.com",
  ],
  // Origins allowed to connect to the HTTP/HTTPS API with Regex
  allowed_regex_origins: [
    "https://.*\\.steamcommunity\\.com",
    "http://.*\\.steamify\\.com",
    "https://.*\\.steamify\\.com",
  ],
  // Optionally configure a global rate limit across all endpoints
  rate_limit: {
    enable: false,
    window_ms: 60 * 60 * 1000, // 60 min
    max: 10000,
  },
  // Logging Level (error, warn, info, verbose, debug, silly)
  logLevel: "debug",
  // Max amount of simultaneous requests from the same IP  (incl. WS and HTTP/HTTPS), -1 for unlimited
  max_simultaneous_requests: 1,
  // Bool to enable game file updates from the SteamDB Github tracker (updated item definitions, images, names)
  enable_game_file_updates: true,
  // Amount of seconds to wait between updating game files (0 = No Interval Updates)
  game_files_update_interval: 3600,
  // Postgres connection string to store results in (ex. postgres://user:pass@127.0.0.1:5432/postgres?sslmode=disable)
  database_url: `postgres://${process.env["POSTGRES_USER"]}:${process.env["POSTGRES_PASSWORD"]}@${process.env["POSTGRES_HOST"]}:${process.env["POSTGRES_PORT"]}/${process.env["POSTGRES_DB"]}`,
  // OPTIONAL: Enable bulk inserts, may improve performance with many requests
  enable_bulk_inserts: false,
  // OPTIONAL: Key by the caller to allow inserting price information, required to use the feature
  price_key: "",
  // OPTIONAL: Key by the caller to allow placing bulk searches
  bulk_key: "",
  // OPTIONAL: Maximum queue size allowed before dropping requests
  max_queue_size: -1,
};
