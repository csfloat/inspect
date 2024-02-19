"use strict";
const fs = require("fs");

const lines = fs.readFileSync("accounts.txt")
  .toString()
  .replace(/\r\n/g, "\n")
  .split("\n")
  .map(line => {
    const parts = line.split(':');
    const accountParts = parts.slice(0, 3);
    const proxyParts = parts.slice(3);
    const proxy = proxyParts.join(':');
    return [...accountParts, `http://${proxy}` || ''].slice(0, 4);
  }).map(line => line.join(":")).join("\n");
fs.writeFileSync("accounts.txt", lines);
console.log(lines);