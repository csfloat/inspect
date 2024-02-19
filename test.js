"use strict";
const fs = require("fs");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const utils = require("./lib/utils");
const winston = require("winston");
const proxyAgent = require('https-proxy-agent');

async function checkProxies(proxies) {
  return proxies.filter(async proxy => {
    const [ip, port, login, password] = proxy.split(':');
    const proxyUrl = `http://${login}:${password}@${ip}:${port}`;
    const agent = new proxyAgent.HttpsProxyAgent(proxyUrl);

    try {
      console.log(`check proxy: ${proxy}`);
      const response = await fetch('https://steamcommunity.com', { agent });
      return response.ok;
    } catch (error) {
      console.log(`Proxy failed: ${proxy}`, error.message);
      return false;
    }
  });
}

async function checkAndWriteProxies() {
  const proxies = fs
    .readFileSync("travchis.txt")
    .toString()
    .split(/\n|\r\n/)
    .filter(line => line.length);

  const healthProxies = await checkProxies(proxies);
  fs.writeFileSync("proxies.txt", proxies.join("\n"));
}

async function main() {
  const proxies = fs
    .readFileSync("proxies.txt")
    .toString()
    .split(/\r\n|\n/);

  const accs = fs
    .readFileSync("accounts.txt")
    .toString()
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line, i) => {
      const parts = line.split(':');
      const accountParts = parts.slice(0, 3);
      return [...accountParts, proxies[i]].slice(0, 4);
    })
    .map(acc => acc.join(":"))
    .join("\n");

  console.log(accs);
  fs.writeFileSync("accounts.txt", accs);
}

async function testLogin() {
  const loginData = {
    logonID: utils.random32BitNumber(),
    accountName: "rocodilef0panichi6247",
    password: "OOJS70YN8IQ3293",
  };
  const steamUser = new SteamUser({httpProxy: "http://WB95I6AL:CDSWBI3G@88.216.182.88:54410"});

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