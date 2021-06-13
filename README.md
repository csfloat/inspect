<p align="center">
  <a href="https://csgofloat.com/">
    <img src="http://i.imgur.com/dzGQk7W.png"/>
  </a>
</p>

[![GitHub stars](https://img.shields.io/github/stars/Step7750/CSGOFloat.svg)](https://github.com/Step7750/CSGOFloat/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Step7750/CSGOFloat.svg)](https://github.com/Step7750/CSGOFloat/network)
[![GitHub issues](https://img.shields.io/github/issues/Step7750/CSGOFloat.svg)](https://github.com/Step7750/CSGOFloat/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/Step7750/CSGOFloat/LICENSE)
[![Website](https://img.shields.io/website-up-down-green-red/https/csgofloat.com.svg)](https://csgofloat.com)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/d/jjicbefpemnphinccgikpdaagjebbnhg.svg)](https://chrome.google.com/webstore/detail/csgofloat-market-checker/jjicbefpemnphinccgikpdaagjebbnhg)
[![Docker](https://img.shields.io/docker/pulls/step7750/csgofloat.svg)](https://hub.docker.com/r/step7750/csgofloat)

CSGOFloat is a free and open source API service that allows you to obtain the float and paint seed of any CSGO item using its inspect link.

### Repo Links

[CSGOFloat-Extension](https://github.com/Step7750/CSGOFloat-Extension)

[CSGOFloat-Website](https://github.com/Step7750/CSGOFloat-Website)

## Table of Contents
  * [API](https://github.com/Step7750/CSGOFloat#api)
  	* [`GET /`](https://github.com/Step7750/CSGOFloat#get-)
		* [Examples](https://github.com/Step7750/CSGOFloat#examples)
	* [`GET /` (Using an Inspect URL)](https://github.com/Step7750/CSGOFloat#get--using-an-inspect-url)
		* [Examples](https://github.com/Step7750/CSGOFloat#examples-1)
	* [Reply](https://github.com/Step7750/CSGOFloat#reply)
	* [Errors](https://github.com/Step7750/CSGOFloat#errors)
  * [How to Install](https://github.com/Step7750/CSGOFloat#how-to-install)
  	* [Docker](https://github.com/Step7750/CSGOFloat#docker)
	* [Manual](https://github.com/Step7750/CSGOFloat#manual)
	* [Steps](https://github.com/Step7750/CSGOFloat#steps)
	* [How to First Login a Bot](https://github.com/Step7750/CSGOFloat#how-to-first-login-a-bot)
	* [Breaking Changes](https://github.com/Step7750/CSGOFloat#breaking-changes)
	* [Args](https://github.com/Step7750/CSGOFloat#args)


# API

**!! If you want to heavily use the public API, please host this repo yourself !!**

### `https://api.csgofloat.com`

### `GET /`

Parameters s, a, d, m can be found in the inspect link of a csgo item. 

| Parameter     | Description   |
|:-------------:|:-------------|
| s             | Optional: If an inventory item, fill out this parameter from the inspect URL |
| a             | Required: Inspect URL "a" param      |
| d             | Required: Inspect URL "d" param      |
| m             | Optional: If a market item, fill out this parameter from the inspect URL      |

##### Examples

`https://api.csgofloat.com/?m=563330426657599553&a=6710760926&d=9406593057029549017`

`https://api.csgofloat.com/?s=76561198084749846&a=6777992090&d=3378412659870065794`



### `GET /` (Using an Inspect URL)

| Parameter     | Description   |
|:-------------:|:-------------|
| url             | Required: Inspect URL of the CSGO item |

##### Examples

`https://api.csgofloat.com/?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A698323590D7935523998312483177`

`https://api.csgofloat.com/?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20M625254122282020305A6760346663D30614827701953021`


### Reply

The reply of this API is based upon [this CSGO protobuf](https://github.com/SteamDatabase/GameTracking-CSGO/blob/a00b71ec84b24e0773c5fbd595eb91e17fa57f8f/Protobufs/cstrike15_gcmessages.proto#L729).

| Attribute     | Data Type     | Description   |
|:-------------:|:-------------:|:--------------|
| itemid        | uint32 | Item ID |
| defindex        | uint32 | Weapon ID |
| paintindex        | uint32 | Paint ID of the weapon (skin) |
| rarity        | uint32 | Rarity value of the weapon |
| quality        | uint32 | Quality of the weapon |
| paintwear        | uint32 | Wear of the exterior of the skin |
| paintseed        | uint32 | Seed for the RNG that defines how to place the skin texture |
| killeatervalue        | uint32 | If the item is StatTrak, this is the amount of kills |
| customname        | string | If the item has a nametag, this is the custom name |
| stickers        | array | Contains data on the placement of stickers |
| origin        | uint32 | Origin ID of the weapon |
| floatvalue        | float | Exterior wear of the skin in its float representation |
| imageurl        | string | Optional: Image of the item |
| min        | float | Minimum wear of the skin |
| max        | float | Maximum wear of the skin |
| item_name        | uint32 | Optional: Name of the skin |
| weapon_type        | string | Weapon type name |
| origin_name        | string | Origin name (Trade-Up, Dropped, etc...) |
| quality_name       | string | Quality name (Souvenir, Stattrak, etc...) |
| rarity_name 	     | string | Rarity name (Covert, Mil-Spec, etc...) |
| wear_name  	     | string | Wear name (Factory New, Minimal Wear, etc...) |
| full_item_name     | string | Full Item Name (ex. SSG 08 Blue Spruce (Minimal Wear)) |


```json
{
	"iteminfo": {
		"accountid": null,
		"itemid": "13874827217",
		"defindex": 7,
		"paintindex": 282,
		"rarity": 5,
		"quality": 4,
		"paintseed": 361,
		"killeaterscoretype": null,
		"killeatervalue": null,
		"customname": null,
		"stickers": [],
		"inventory": 11,
		"origin": 8,
		"questid": null,
		"dropreason": null,
		"musicindex": null,
		"s": "0",
		"a": "13874827217",
		"d": "4649025583329100061",
		"m": "2608048286785948758",
		"floatvalue": 0.22740158438682556,
		"imageurl": "http://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_ak47_cu_ak47_cobra_light_large.7494bfdf4855fd4e6a2dbd983ed0a243c80ef830.png",
		"min": 0.1,
		"max": 0.7,
		"weapon_type": "AK-47",
		"item_name": "Redline",
		"rarity_name": "Classified",
		"quality_name": "Unique",
		"origin_name": "Found in Crate",
		"wear_name": "Field-Tested",
		"full_item_name": "AK-47 | Redline (Field-Tested)"
	}
}
```

### `POST /bulk`

Allows you to request the inspect link data for multiple items at once.

NOTE: Ensure that you send proper `Content-Type: application/json` headers

Request Body:

```json
{
	"links": [
		{"link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20M2906459769049600931A18971892678D9403672490970763167"},
		{"link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20M2907585668964658722A17231546984D5353704955732169451"}
	]
}
```

Example Response:

```json
{
    "18971892678": {
        "origin": 8,
        "quality": 4,
        "rarity": 5,
        "a": "18971892678",
        "d": "9403672490970763167",
        "paintseed": 49,
        "defindex": 7,
        "paintindex": 282,
        // STUB...
    },
    "17231546984": {
        "origin": 4,
        "quality": 4,
        "rarity": 4,
        "a": "17231546984",
        "d": "5353704955732169451",
        "paintseed": 597,
        "defindex": 9,
        "paintindex": 838,
        // STUB...
    },
    ...
}
```

### `GET /stats`

Gives some data on the current status of your bots and queue.

Example:
```json
{"bots_online":100,"bots_total":100,"queue_size":20,"queue_concurrency":100}
```

## Errors

##### Error Codes

| Code     | Description   |
|:-------------:|:-------------|
| 1             | Improper Parameter Structure |
| 2             | Invalid Inspect Link Structure |
| 3             | You may only have X pending request(s) at a time |
| 4             | Valve's servers didn't reply in time |
| 5             | Valve's servers appear to be offline, please try again later! |
| 6             | Something went wrong on our end, please try again |
| 7             | Improper body format |
| 8             | Bad Secret |

##### Example Error

```json
{
	"error": "Valve's servers didn't reply in time",
	"code": 4
}
```

If using a `/bulk` request and the error only applies to a specific inspect link, the returned response for it will be
replaced while other inspect links will be processed normally. If the error applies to the entire request (ie. bad post body),
it will return a root-level error as shown above.

Example:

```
{
    "18971892678": {
        "origin": 8,
        "quality": 4,
        "rarity": 5,
        "a": "18971892678",
        "d": "9403672490970763167",
        "paintseed": 49,
        "defindex": 7,
        "paintindex": 282,
        // STUB...
    },
    "16231546984": {
        "error": "Valve's servers didn't reply in time",
        "code": 4,
        "status": 500
    }
}
```


# How to Install

In order to retrieve float values for weapons in this way, you must have Steam account(s) with a copy of CS:GO. Each account can request 1 float per second. CSGOFloat allows you to have as many bots as you'd like by inputting the login info into config.js.

Each instance of CSGOFloat can operate around 300 accounts. It is recommended to either configure a Postgres server or setup another cache such as Varnish or Nginx in front of your server. 

## Docker

Pull the [image](https://hub.docker.com/r/step7750/csgofloat) from docker and mount the config directory

```
docker pull step7750/csgofloat:latest
docker run -d --name csgofloat -v /host/config:/config -p 80:80 -p 443:443 step7750/csgofloat:latest
```

The first time you start the docker container, it'll copy the `config.js` file to the config directory and stop. You'll need to edit this file and include your bots login information and then start the docker again. See the section [How to First Login a Bot](https://github.com/Step7750/CSGOFloat#how-to-first-login-a-bot) for further info.

## Manual

Requires Node.js v8+!

Clone the repo (or `npm install csgofloat`) and install the Node.js dependencies using `npm install` or `yarn install` in the root directory.

#### Steps:

1. Copy `config.example.js` to `config.js`
2. Add your bot(s) login information to `config.js`
3. Edit `config.js` with your desired settings
4. Ensure Postgres is running if you've set it's database url
5. Run `node index.js` in the main directory
6. [How to First Login a Bot](https://github.com/Step7750/CSGOFloat#how-to-first-login-a-bot)
7. Navigate to the IP that the server is hosted on and query the API using the docs above!

## How to First Login a Bot

**Note**: If the bot has never logged into the steam client before and doesn't have Mobile 2FA enabled (fresh account), you can just input the username and password and it should successfully log in without email 2FA

If your bot doesn't own CS:GO, CSGOFloat will automatically try to obtain a license for it during startup.

* Using Email 2FA
	* Only fill in the `user` and `pass` fields for the bot (make sure the `auth` field is empty or removed)
	* Start up CSGOFloat
	* It will tell you that an auth code was sent to your email
	* Input the code from your email into the `auth` field for the bot
	* Restart CSGOFloat
	* It should successfully login and create a sentry file in the current [node-steam-user config directory](https://github.com/DoctorMcKay/node-steam-user#datadirectory)
	* The `auth` field can now be optionally removed in your login file for further logins
* Using Mobile 2FA
	* Fill in the `user` and `pass` fields for the bot
	* Fill in the `auth` field with the `shared_secret` for the bot
	* Start up CSGOFloat
	* It should successfully login and create a sentry file in the current [node-steam-user config directory](https://github.com/DoctorMcKay/node-steam-user#datadirectory)
	* You'll need to keep the `auth` field filled in for future logins

## Breaking Changes

### v3.0 -> v4.0

* MongoDB is no longer supported, use Postgres instead
* Socket.io access is no longer supported
* Built-in HTTPS handling has been removed, reverse proxy to HTTP instead

### v2.0 -> v3.0

* Since we now use node-steam-user instead of node-steam, the sentry folder location now [depends on your system](https://github.com/DoctorMcKay/node-steam-user#datadirectory). If you'd like to migrate sentry files from v2.0 rather than having to reauthenticate email 2FA accounts, you'll need to copy your sentry files and rename them to match node-steam-user's format
* `allow_simultaneous_requests` has now been replaced by `max_simultaneous_requests`. You can set `max_simultaneous_requests` to `-1` to allow an infinite amount of simultaneous requests by the same IP.

## Args

### `-c`/`--config` (default `./config.js`)

CSGOFloat config file location

### `-s`/`--steam_data` (default [node-steam-user config directory](https://github.com/DoctorMcKay/node-steam-user#datadirectory))

node-steam-user config directory
