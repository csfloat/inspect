global._mckay_statistics_opt_out = true; // Opt out of node-steam-user stats

const optionDefinitions = [
  { name: "config", alias: "c", type: String, defaultValue: "./config.js" }, // Config file location
  { name: "steam_data", alias: "s", type: String, defaultValue: "./steam_data" }, // Steam data directory
];

const
  fs = require("fs"),
  winston = require("winston"),
  args = require("command-line-args")(optionDefinitions),
  bodyParser = require("body-parser"),
  rateLimit = require("express-rate-limit"),
  utils = require("./lib/utils"),
  queue = new (require("./lib/queue"))(),
  InspectURL = require("./lib/inspect_url"),
  CONFIG = require(args.config),
  botController = new (require("./lib/bot_controller"))(Object.assign({}, CONFIG.bot_settings)),
  postgres = new (require("./lib/postgres"))(CONFIG.database_url, CONFIG.enable_bulk_inserts),
  gameData = new (require("./lib/game_data"))(
    CONFIG.game_files_update_interval,
    CONFIG.enable_game_file_updates,
  ),
  errors = require("./errors"),
  Job = require("./lib/job");

if (CONFIG.max_simultaneous_requests === undefined) {
  CONFIG.max_simultaneous_requests = 1;
}

winston.level = CONFIG.logLevel || "debug";

if (args.steam_data) {
  CONFIG.bot_settings.steam_user.dataDirectory = args.steam_data;
} else {
  fs.mkdirSync("./steam_data");
  CONFIG.bot_settings.steam_user.dataDirectory = "./steam_data";
}

postgres.connect();


fs.readFileSync("accounts.txt")
  .toString()
  .replace(/\r\n/g, "\n")
  .split("\n")
  .map(line => {
    const parts = line.split(':');
    const accountParts = parts.slice(0, 3);
    const proxyParts = parts.slice(3);
    const proxy = proxyParts.join(':');
    return [...accountParts, proxy || ''].slice(0, 4);
  })
  .forEach(([username, password, shared_secret, proxy]) =>
    botController.addBot({ username: username, password: password, auth: shared_secret || null, proxy: proxy || null })
);


// Setup and configure express
const app = require("express")();
app.use(function (req, res, next) {
  if (req.method === "POST") {
    // Default content-type
    req.headers["content-type"] = "application/json";
  }
  next();
});
app.use(bodyParser.json({ limit: "500mb" }));

app.use(function (error, req, res, next) {
  // Handle bodyParser errors
  if (error instanceof SyntaxError) {
    errors.BadBody.respond(res);
  } else next();
});

if (CONFIG.trust_proxy === true) {
  app.enable("trust proxy");
}

CONFIG.allowed_regex_origins = CONFIG.allowed_regex_origins || [];
CONFIG.allowed_origins = CONFIG.allowed_origins || [];
const allowedRegexOrigins = CONFIG.allowed_regex_origins.map(origin => new RegExp(origin));

async function handleJob(job) {
  // See which items have already been cached
  const itemData = await postgres.getItemData(job.getRemainingLinks().map(e => e.link));

  for (let item of itemData) {
    const link = job.getLink(item.a);

    if (!item.price && link.price) {
      postgres.updateItemPrice(item.a, link.price);
    }

    gameData.addAdditionalItemProperties(item);

    item = utils.removeNullValues(item);

    job.setResponse(item.a, item);
  }

  if (!botController.hasBotOnline()) {
    return job.setResponseRemaining(errors.SteamOffline);
  }

  if (
    CONFIG.max_simultaneous_requests > 0 &&
    queue.getUserQueuedAmt(job.ip) + job.remainingSize() > CONFIG.max_simultaneous_requests
  ) {
    return job.setResponseRemaining(errors.MaxRequests);
  }

  if (CONFIG.max_queue_size > 0 && queue.size() + job.remainingSize() > CONFIG.max_queue_size) {
    return job.setResponseRemaining(errors.MaxQueueSize);
  }

  const bot = botController.getFreeBot();
  if (!bot) {
    return job.setResponseRemaining(errors.NoBotsAvailable);
  }

  if (job.remainingSize() > 0) {
    queue.addJob(job, CONFIG.bot_settings.max_attempts);
  }
}

function canSubmitPrice(key, link, price) {
  return (
    CONFIG.price_key &&
    key === CONFIG.price_key &&
    price &&
    link.isMarketLink() &&
    utils.isOnlyDigits(price)
  );
}

app.use(function (req, res, next) {
  if (CONFIG.allowed_origins.length > 0 && req.get("origin") !== undefined) {
    // check to see if its a valid domain
    const allowed =
      CONFIG.allowed_origins.indexOf(req.get("origin")) > -1 ||
      allowedRegexOrigins.findIndex(reg => reg.test(req.get("origin"))) > -1;

    if (allowed) {
      res.header("Access-Control-Allow-Origin", req.get("origin"));
      res.header("Access-Control-Allow-Methods", "GET");
    }
  }
  next();
});

app.get("/api/inspect", async (req, res) => {
  // Get and parse parameters
  let link;

  if ("url" in req.query) {
    link = new InspectURL(req.query.url);
  } else if ("a" in req.query && "d" in req.query && ("s" in req.query || "m" in req.query)) {
    link = new InspectURL(req.query);
  }

  winston.info(`GET /: link=${link}`)

  if (!link || !link.getParams()) {
    return errors.InvalidInspect.respond(res);
  }

  const job = new Job(req, res, /* bulk */ false);

  let price;

  if (canSubmitPrice(req.query.priceKey, link, req.query.price)) {
    price = parseInt(req.query.price);
  }

  job.add(link, price);

  try {
    await handleJob(job);
  } catch (e) {
    winston.warn(e);
    errors.GenericBad.respond(res);
  }
});

app.post("/api/inspect/bulk", async (req, res) => {
  if (!req.body || (CONFIG.bulk_key && req.body.bulk_key !== CONFIG.bulk_key)) {
    return errors.BadSecret.respond(res);
  }

  if (!req.body.links || req.body.links.length === 0) {
    return errors.BadBody.respond(res);
  }

  if (
    CONFIG.max_simultaneous_requests > 0 &&
    req.body.links.length > CONFIG.max_simultaneous_requests
  ) {
    return errors.MaxRequests.respond(res);
  }

  const job = new Job(req, res, /* bulk */ true);

  for (const data of req.body.links) {
    const link = new InspectURL(data.link);
    if (!link.valid) {
      winston.warn(`Invalid link: ${data.link}`)
      continue
    }

    let price;

    if (canSubmitPrice(req.body.priceKey, link, data.price)) {
      price = parseInt(req.query.price);
    }

    job.add(link, price);
  }

  try {
    await handleJob(job);
  } catch (e) {
    winston.warn(e);
    errors.GenericBad.respond(res);
  }
});

app.get("/api/stats", (req, res) => {
  res.json({
    bots_online: botController.getReadyAmount(),
    bots_total: botController.bots.length,
    queue_size: queue.queue.length,
    queue_concurrency: queue.concurrency,
  });
});

app.post("/api/account/sync", (req, res) => {
  return res.status(400).send(JSON.stringify({ success: false, message: "try later" }));

  if (!req.body) return errors.BadBody.respond(res);

  const accounts = req.body.accounts;

  if (!Array.isArray(accounts))
    return errors.BadBody.respond(res);

  try {
    botController.syncBots(accounts);
    res.status(200).send(JSON.stringify({ success: true }))
  } catch (e) {
    winston.warn(e);
    errors.GenericBad.respond(res);
  }
});

const http_server = require("http").Server(app);
http_server.listen(CONFIG.http.port);
winston.info("Listening for HTTP on port: " + CONFIG.http.port);

queue.process(botController.bots.length, botController, async job => {
  const itemData = await botController.lookupFloat(job.data.link);
  winston.debug(`Received itemData for ${job.data.link.getParams().a}`);

  // Save and remove the delay attribute
  let delay = itemData.delay;
  delete itemData.delay;

  // add the item info to the DB
  await postgres.insertItemData(itemData.iteminfo, job.data.price);

  // Get rank, annotate with game files
  itemData.iteminfo = Object.assign(
    itemData.iteminfo,
    await postgres.getItemRank(itemData.iteminfo.a),
  );

  gameData.addAdditionalItemProperties(itemData.iteminfo);

  itemData.iteminfo = utils.removeNullValues(itemData.iteminfo);
  itemData.iteminfo.stickers = itemData.iteminfo.stickers.map(s => utils.removeNullValues(s));

  job.data.job.setResponse(job.data.link.getParams().a, itemData.iteminfo);

  return delay;
});

queue.on("job failed", (job, err) => {
  const params = job.data.link.getParams();
  winston.warn(
    `Job Failed! S: ${params.s} A: ${params.a} D: ${params.d} M: ${params.m} IP: ${job.ip}, Err: ${(err || "").toString()}`,
  );

  job.data.job.setResponse(params.a, errors.TTLExceeded);
});

process.on("unhandledRejection", (reason, promise) => {
  promise.catch(err => {
    winston.error(err)
  });
});