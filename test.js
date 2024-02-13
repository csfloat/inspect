"use strict";
const fs = require("fs");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const utils = require("./lib/utils");
const winston = require("winston");



async function main() {
  const accounts = fs.readFileSync("accs.txt").toString().split("\n")
    .map(e => e.split(",,"));

  const clients = [];
  for (let [username, password] of accounts) {
    const loginData = {
      logonID: utils.random32BitNumber(),
      accountName: username,
      password: password,
    };
    const steamUser = new SteamUser();

    await login(steamUser, loginData);

    const csgo = new GlobalOffensive(steamUser);

    csgo.on("connectedToGC", () => {
      winston.info(`${username} CSGO Client Ready!`);

      this.ready = true;
    });

    csgo.on("disconnectedFromGC", reason => {
      winston.warn(`${username} CSGO unready (${reason}), trying to reconnect!`);
      this.ready = false;
    });

    csgo.on("connectionStatus", status => {
      winston.debug(`${username} GC Connection Status Update ${status}`);
    });

    csgo.on("debug", msg => {
      winston.debug(msg);
    });

  }
}


async function login(steamClient, loginData) {
  return new Promise((resolve, reject) => {
    steamClient.on("loggedOn", (details, parental) => {
      winston.info(`${loginData.accountName} Log on OK`);
      resolve();
    });
    steamClient.logOn(loginData);
  });
}

main();