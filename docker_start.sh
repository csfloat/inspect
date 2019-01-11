#!/bin/bash

if [ ! -f /config/config.js ]; then
    cp /usr/src/csgofloat/config.example.js /config/config.js
    echo "Copied example config file to /config/config.js, please edit this file and restart"
else
    node index.js -c /config/config.js
fi
