#!/bin/bash

if [ ! -d steam_data ]; then
    mkdir steam_data
fi

node index.js -c config.js -s steam_data
