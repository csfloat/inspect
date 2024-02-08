#!/bin/bash

if [ ! -d /config/steam_data ]; then
    mkdir /config/steam_data
fi

node index.js -c /config/config.js -s /config/steam_data
