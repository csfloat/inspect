"use strict";
const fs = require("fs");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const utils = require("./lib/utils");
const winston = require("winston");
const proxyAgent = require('https-proxy-agent');

const http = require('http');

const errors = [
  'Bad proxy string',
  'Proxy offline'
];

const proxy_check = p => {
  return new Promise((resolve, reject) => {

    let proxy = {
      host: '',
      port: 0,
      proxyAuth: ''
    };

    if (typeof p === 'object') {
      if (Array.isArray(p)) {
        if (typeof p[0] === 'object') {
          proxy = p[0];
        } else if (typeof p === 'string') {
          p = p[0];
        } else {
          return reject(errors[0]);
        }
      } else {
        proxy = p;
      }
    }

    if (typeof p === 'string') {
      if (p.indexOf('@') + 1) {
        proxy.proxyAuth = p.split('@')[0];
        const host_port = p.split('@')[1];
        if (host_port.indexOf(':') + 1) {
          proxy.host = host_port.split(':')[0];
          proxy.port = host_port.split(':')[1];
        }
      } else {
        if (p.indexOf(':') + 1) {
          proxy.host = p.split(':')[0];
          proxy.port = p.split(':')[1];
        }
      }
    }

    const proxy_options = {
      method: 'CONNECT',
      path: 'www.google.com:443',
      timeout: 1000,
      agent: false
    };

    if (proxy.host) {
      proxy_options.host = proxy.host;
    }
    if (proxy.port) {
      proxy_options.port = proxy.port;
    }
    if (proxy.proxyAuth) {
      proxy_options.headers = {
        'Proxy-Authorization': 'Basic ' + Buffer.from(proxy.proxyAuth).toString('base64')
      };
    }

    const req = http.request(proxy_options);
    req.on('connect', res => {
      req.destroy();
      if (res.statusCode === 200) {
        return resolve(p);
      } else {
        return reject(errors[1]);
      }
    });
    req.on('timeout', () => {
      req.destroy();
    });
    req.on('error', err => {
      return reject((err && err.code) || errors[1]);
    });
    req.end();

  });
}

async function checkProxies(proxies) {
  return await Promise.allSettled(proxies.map(p => proxy_check(p)));
}

async function checkAndWriteProxies() {
  const proxies = fs
    .readFileSync("travchis.txt")
    .toString()
    .split(/\n|\r\n/)
    .filter(line => line.length)
    .map(str => {
      const [ip, port, login, pass] = str.split(":");
      return {
        host: ip,
        port: parseInt(port),
        proxyAuth: `${login}:${pass}`
      };
    });

  const checked = await checkProxies(proxies);

  const healthProxies = checked
    .filter(res => res.status !== 'rejected')
    .map(obj => `${obj.value.host}:${obj.value.port}:${obj.value.proxyAuth.split(":")[0]}:${obj.value.proxyAuth.split(":")[1]}`);

  fs.writeFileSync("proxies.txt", healthProxies.join("\n"));
}

async function main() {
  await checkAndWriteProxies();
  await resetProxies();
}

async function resetProxies() {
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