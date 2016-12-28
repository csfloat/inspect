# CSGOFloat

Source Code that Powers the CSGOFloat API

The frontend of the site is on the gh-pages branch, if you'd like to take a look at it.

# API

**If you want to heavily use the public API, please host this repo yourself**

You can find this same info on the site by clicking the API button here: http://csgofloat.com/

URL Endpoint: `api.csgofloat.com`

HTTPS PORT: `1738`

HTTP PORT: `1739`


#### `GET /`

Parameters s, a, d, m can be found in the inspect link of a csgo item. 

| Parameter     | Description   |
|:-------------:|:-------------|
| s             | Optional: If an inventory item, fill out this parameter from the inspect URL |
| a             | Required: Inspect URL "a" param      |
| d             | Required: Inspect URL "d" param      |
| m             | Optional: If a market item, fill out this parameter from the inspect URL      |

##### Examples

`https://api.csgofloat.com:1738/?m=563330426657599553&a=6710760926&d=9406593057029549017`

`https://api.csgofloat.com:1738/?s=76561198084749846&a=6777992090&d=3378412659870065794`



#### `GET /` (Using an Inspect URL)

| Parameter     | Description   |
|:-------------:|:-------------|
| url             | Required: Inspect URL of the CSGO item |

##### Examples

`https://api.csgofloat.com:1738/?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A698323590D7935523998312483177`

`https://api.csgofloat.com:1738/?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20M625254122282020305A6760346663D30614827701953021`


## Reply

The reply of this API is based upon [this CSGO protobuf](https://github.com/SteamRE/SteamKit/blob/master/Resources/Protobufs/csgo/cstrike15_gcmessages.proto#L674). I recommend looking at the Github in order to understand how some of these parameters work.

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
| itemid_int        | uint32 | ID of the item |
| item_name        | uint32 | Optional: Name of the skin |
| weapon_type        | string | Weapon type name |


```json
{
	"iteminfo": {
		"accountid": null,
		"itemid": {
			"low": -1766118817,
			"high": 1,
			"unsigned": true
		},
		"defindex": 7,
		"paintindex": 282,
		"rarity": 5,
		"quality": 4,
		"paintwear": 1043366112,
		"paintseed": 61,
		"killeaterscoretype": null,
		"killeatervalue": null,
		"customname": null,
		"stickers": [{
			"slot": 2,
			"sticker_id": 180,
			"wear": null,
			"scale": null,
			"rotation": null
		}],
		"inventory": 3221225482,
		"origin": 4,
		"questid": null,
		"dropreason": null,
		"floatvalue": 0.17236661911010742,
		"imageurl": "http://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_ak47_cu_ak47_cobra_light_large.7494bfdf4855fd4e6a2dbd983ed0a243c80ef830.png",
		"min": 0.1,
		"max": 0.7,
		"itemid_int": 2528848479,
		"item_name": "Redline",
		"s": "0",
		"a": "6823815775",
		"d": "16727143683740967735",
		"m": "638766174011039879",
		"weapon_type": "AK-47"
	}
}
```

## Errors

The API might be unstable at times, so it is important that you handle the errors correctly.

##### Error Codes

| Code     | Description   |
|:-------------:|:-------------|
| 1             | Improper Parameter Structure |
| 2             | Invalid Inspect Link Structure |
| 3             | You may only have one pending request at a time |
| 4             | Valve's servers didn't reply in time |
| 5             | Valve's servers appear to be offline, please try again later! |

##### Example Error

```json
{
	"error": "Valve's servers didn't reply",
	"code": 4
}
```



# How to Run

In order to retrieve float values for weapons in this way, you must have Steam account(s) with a copy of CS:GO. Each account can request 1 float per second. CSGOFloat allows you to have as many bots as you'd like by inputting the login info into config.json.

##### Dependencies:

* node-csgo (v1.4 or higher)
* socket.io
* express
* mongodb
* redis
* kue

You can install the Node.js dependencies using `npm install` or `yarn install`

##### Steps:

1. Add your bot(s) info into config.json
2. Edit config.json with your desired settings
3. Update the gamefiles directory from a CSGO installation (ensure the csgo_english file is encoded in UTF-8)
4. Ensure mongodb and redis are running
5. Navigate to the IP that it is being hosted on and query the API using the docs above!
