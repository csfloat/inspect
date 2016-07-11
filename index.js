var express = require('express'),
    http = require('http'),
    https = require('https'),
    kue = require('kue'),
    queue = kue.createQueue(),
    cp = require('child_process'),
    dbhandler = require('./dbhandler.js'),
    fs = require('fs');


// Get the bot login info
var user_pass_info = JSON.parse(fs.readFileSync('logins.json', 'utf8'));


// API Variables

var HTTPport = 1739;
var HTTPSport = 1738;
var isValveOnline = false; // boolean that defines whether all the bots are offline or not
var apiObjs = {}; // Holds the request objects
var maxATTEMPTS = 1; // Number of attempts for each request
var failedAttempts = {};

// BOT Variables

var bot_number = user_pass_info["logins"].length; // Stores the number of bots
var botData = []; // Stores current bot about regarding their job, child, ready/busy state, and done objects
var requestWait = 1100 // Milliseconds to wait between requests to Valve
var onlyRestart = false;


// SSL Variables

var privateKey  = fs.readFileSync('certs/sslnopass.key', 'utf8');
var certificate = fs.readFileSync('certs/api.csgofloat.com.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};


// Push default bot values of them being offline
for(var i = 0; i < bot_number; i++) {
	botData[i] = {};
	botData[i]["ready"] = 0;
	botData[i]["busy"] = 1;
	botData[i]["obj"] = null;
	botData[i]["childid"] = null;
	botData[i]["doneobj"] = null;
	botData[i]["requested"] = null;
}


if (bot_number == 0) {
	console.log('There are no bot logins, please input some into logins.json. Exiting...');
	process.exit(1);
}


function forkChild(index) {
	var cur_login = user_pass_info["logins"][index];
  	cur_login["index"] = index;
  	console.log("Creating child process for " + cur_login["user"]);
  	var newchild = cp.fork('./child', [JSON.stringify(cur_login, null, 2)]);

  	newchild.on('message', function(m) {
    
    	if (m[0] == "ready") {
	      	console.log("Bot " + m[1] + " is ready");

	      	// Set values are a ready bot
	      	botData[m[1]]["ready"] = 1;
	      	botData[m[1]]["busy"] = 0;

	      	var isActive = true;
	      	for (var activeindex = 0; activeindex < botData.length; activeindex++) {
	      		if (botData[activeindex]["ready"] == 0) {
	      			isActive = false;
					break;
	      		}
	      	}

	      	if (isActive) {
	      		// ready to send out requests
	        	console.log("Bots are ready to accept requests");
	        	io.emit('successmessage', "Valve's servers are online!");
	        	isValveOnline = true;

	        	// If a bot errored out, only restart the queue
	        	if (onlyRestart) {
	        		apiObjs = {};
	        	}
	        	else {
	        		resetQueue();
	        	}
	      	}
    	}
	    else if (m[0] == "genericmsg") {
	    	// Emit this message to a websocket client
	    	io.to(m[3]).emit(m[1], m[2]);
	    }
	    else if (m[0] == "itemdata") {
	    	// Tell kue that this job is finished


			// Call done on Kue
			if (m[1] in botData) {
				var currenttime = new Date().getTime();
				var offset = currenttime-botData[m[1]]["requested"];

				// We ensure a delay of requestWait between requests for this bot
				if (offset < requestWait) {
					console.log("Delaying for " + (requestWait-offset) + "ms, it took " + offset + "ms for the request");

					setTimeout(function(){ 
						botData[m[1]]["doneobj"]();

						// This bot is no longer busy (MAKE SURE THIS IS CALLED AFTER DONE)
						// Otherwise, Kue will asign the bot with a new request and overwrite the old done object
						// Then it will time out this good request and block the user
	    				botData[m[1]]["busy"] = 0;
					}, (requestWait-offset));
				}
				else {
					// Just call done
					botData[m[1]]["doneobj"]();

					// This bot is no longer busy (MAKE SURE THIS IS CALLED AFTER DONE)
	    			botData[m[1]]["busy"] = 0;
				}

				// Clear up the attempts
				if (botData[m[1]]["childid"] in failedAttempts) {
					console.log("Clearing attempts for " + botData[m[1]]["childid"]);
					delete failedAttempts[botData[m[1]]["childid"]];
				}
	    	}

	    	// Add the float to the DB so that it can be used next time for this same request
	    	dbhandler.insertFloat(m[3]["iteminfo"], function (err, result) {
	    		if (!err) {
	    			console.log("Inserted the result into the db");
	    		}
	    		if (m[2] != null) {
	    			// This is a websocket request

		    		io.to(m[2]).emit("floatmessage", m[3]);

		    		// found out ip and remove it
		    		if (m[2] in io.sockets.connected) {
		    			var socketip = io.sockets.connected[m[2]].request.connection.remoteAddress;
			    		if (socketip in apiObjs) {
			    			delete apiObjs[socketip];
			    		}
		    		}
		    	}
		    	else if (m[4] != null) {
		    		// This is an HTTP request

		    		// Reply to it and delete it
		    		if (apiObjs[m[4]] != undefined) {
		    			apiObjs[m[4]].json(m[3]);
		    			delete apiObjs[m[4]];
		    		}
		    	}
	    	});
	    }
	    else if (m[0] == "unready") {
	      	console.log("Bot " + m[1] + " is not ready");

	      	// Bot is no longer ready
	      	botData[m[1]]["ready"] = 0;

	      	// We don't need to instantiate the queue again
	      	onlyRestart = true;

	      	// Tell websocket users
	      	if (isValveOnline) {
	      		io.emit('errormessage', "Valve's servers appear to be offline");
	      	}

	      	// Don't let people put in requests now
	      	isValveOnline = false;
	      	// Kill the child and relaunch it
	      	botData[m[1]]["obj"].kill();

	      	// Fork the bot again and log it in
          	forkChild(m[1]);
          	botData[m[1]]["obj"].send(['login']);
	    }
  	});

  	// Store the bot in an object
  	botData[index]["obj"] = newchild;
}

// Create the child processes that handle the communication to Valve
for(var x = 0; x < bot_number; x++) {

	// Create child process with it's login info
  	forkChild(x);
}


// Setup and configure express
var app = express();

var server = http.Server(app);
var httpsserver = https.Server(credentials, app);
var io = require('socket.io')(httpsserver);

app.get('/', function(req, res) {
	// HTTP/HTTPS API Handler

	// Allow CORS
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET');
	

	// Verify proper parameters
	if (("a" in req.query && "d" in req.query && ("s" in req.query || "m" in req.query)) || "url" in req.query) {
		// Either s or m is filled out
		if ("m" in req.query) {
			req.query.s = "0";
		}
		else {
			req.query.m = "0";
		}

		// Obtain the inspect urls
		if ("url" in req.query) {
			var inspectURL = req.query.url;
		}
		else {
			var inspectURL = buildInspectURL(req.query);
		}

		var lookupVars = parseLookupText(inspectURL);

		// Check if there are valid variables
		if (lookupVars != false) {
			dbhandler.checkInserted(lookupVars, function (err, result) {
				if (result != false) {
					res.json({iteminfo: result});
				}
				else {
					
					if (isValveOnline) {
						var userIP = req.connection.remoteAddress;

						if (!(userIP in apiObjs)) {
							apiObjs[userIP] = res;
							create_job(false, userIP, lookupVars);
						}
						else {
							res.status(500).json({error: "You may only have one pending request at a time", code:3});
						}
					}
					else {
						res.status(500).json({error: "Valve's servers appear to be offline, please try again later", code:5});
					}
				}
			});

		}
		else {
			res.status(500).json({error: "Invalid Inspect Link Structure", code:2});
		}
	}
	else {
		res.status(500).json({error: "Improper Parameter Structure", code:1});
	}
});


/*
Returns an inspect url given a user's query
*/
function buildInspectURL(query) {
	url = ""
  	if (query["s"] == "0") {
    	url = "steam://rungame/730/76561202255233023/+csgo_econ_action_preview M" + query.m + "A" + query.a + "D" + query.d;
  	}
  	else {
    	url = "steam://rungame/730/76561202255233023/+csgo_econ_action_preview S" + query.s + "A" + query.a + "D" + query.d;
  	}

  	return url;
}

/*
Handles websocket float request
*/
function LookupHandler(link, socket) {
	lookupVars = parseLookupText(link);

	if (lookupVars != false) {

		dbhandler.checkInserted(lookupVars, function (err, result) {
			if (result != false) {
				socket.emit("floatmessage", {iteminfo: result});
			}
			else {
				if (isValveOnline) {
					var socketip = socket.request.connection.remoteAddress;
					if (socketip in apiObjs) {
						socket.emit('errormessage', "You may only have one pending request at a time");
					}
					else {
						create_job(socket, false, lookupVars);
						apiObjs[socketip] = true;
					}
				}
				else {
					socket.emit('errormessage', "Valve's servers appear to be offline, please try again later");
				}
			}
		});
	}
	else {
		socket.emit('errormessage', "We couldn't parse the inspect link, are you sure it is correct?")
	}
}

/*
Returns s, m, a, d parameters given an inspect link
*/
function parseLookupText(link) {
	// For the API, + signs get converted to a space in Express, so we account for that
	var regexed = link.match(/steam:\/\/rungame\/730\/\d*\/[+ ]csgo_econ_action_preview [SM]\d*[A]\d*[D]\d*/g);

	// Return variable
	var returnVars = false;

  	if (regexed != null && regexed[0] == link) {
	    // the string still appears to be a valid structure
	    // check whether it is a market or inventory request
	    var lookup_type = link.match(/[+ ]csgo_econ_action_preview (.)\d*/);

	    if (lookup_type[1] != null) {
	      	// get the data of the individual vars of the lookup string
	      	var variable_type = link.match(/[MS](.*)A/);
	      	var a = link.match(/[A](.*)D/);
	      	var d = link.match(/[D](.*)/);


	      	if (typeof variable_type[1] == "string" && typeof a[1] == "string" && typeof d[1] == "string") {
	      		// Verify that we are dealing with strings
		        var svar = "0";
		        var mvar = "0";
		        var dvar = d[1];
		        var avar = a[1];

		        // Process whether this is from a market or inventory item
		        if (lookup_type[1] == "M") {
		          	mvar = variable_type[1];
		        }
		        else {
		          	svar = variable_type[1];
		        }

		        // Overwrite the return val
		        returnVars = [svar, avar, dvar, mvar];
	      	}
	    }
	}

	return returnVars;
}

/*
Creates a Kue job given a float request
*/
function create_job(socket, request, LookupVars) {
	// Support for http and websockets

  	// Create job with TTL of 3000, it will be considered a fail if a child process
  	// doesn't return a value within 3sec

  	var job = queue.create('floatlookup', {
	    socketid: socket.id,
	    request: request,
	    s: LookupVars[0],
	    a: LookupVars[1],
	    d: LookupVars[2],
	    m: LookupVars[3]
 	}).ttl(2000).attempts(maxATTEMPTS).removeOnComplete(true).save(function (err) {
      	if (err) {
	      	console.log("There was an error adding the job to the queue");
	      	console.log(err);
	      	if (socket != false) {
	      		socket.emit("errormessage", "There was an error adding the job to the queue");
	      	}
      	}
		else {
			if (socket != false) {
				socket.emit("infomessage", "Your request for " + LookupVars[1] + " is in the queue");
			}
		}
    });
}

/*
Resets the queue (initiated once the bots login)
*/
function resetQueue() {

	server.listen(HTTPport);
	httpsserver.listen(HTTPSport);

	// Socket.io event handler
	io.on('connection', function (socket) {
	  	socket.emit('joined');
	  	socket.emit('infomessage', 'You no longer have to login! Have fun!');

	  	if (!isValveOnline) {
	  		socket.emit('errormessage', "Valve's servers appear to be offline, please try again later");
	  	}

	  	socket.on('lookup', function(link){
	  		LookupHandler(link, socket);
	    });
	});


	// Remove any current inactive jobs in the Kue
	queue.inactive( function( err, ids ) {
    	ids.forEach( function( id ) {
      		try {
        		kue.Job.get( id, function( err, job ) {
          			if (job != undefined) {
            			job.remove();
          			}
        		});
      		}
      		catch (err) {
        		console.log("Couldn't obtain job when parsing inactive jobs")
      		}
    	});
  	});

	restart_queue();
}


queue.on('job error', function(id, err){
    console.log("Job error " + err + " with " + id);
    // There was a timeout of 3sec, reset the bots busy state

    // Find which bot was handling this request
	for(var x2 = 0; x2 < bot_number; x2++) {
		if (id == botData[x2]["childid"]) {
			// found the index of the bot, change the status
			console.log("Found bot to reset value " + x2);

			// Increment the failed attempt
			if (id in failedAttempts) {
				failedAttempts[id] += 1;
			}
			else {
				failedAttempts[id] = 1;
			}

			if (failedAttempts[id] == maxATTEMPTS) {

				// Clear up the attempt
				if (id in failedAttempts) {
					delete failedAttempts[id];
				}

				// Tell the client
				try {
					kue.Job.get(id, function (err, job) {
						console.log("Failed Job " + id);
						if (job["data"]["socketid"] != undefined) {
							io.to(job["data"]["socketid"]).emit("errormessage", "We couldn't retrieve the item data, are you sure you inputted the correct inspect link?");
							var socketip = io.sockets.connected[job["data"]["socketid"]].request.connection.remoteAddress;
							if (socketip in apiObjs) {
								delete apiObjs[socketip];
							}
						}
						else if (job["data"]["request"] != undefined && job["data"]["request"] in apiObjs) {
							// failed http request
							apiObjs[job["data"]["request"]].status(500).json({
								error: "Valve's servers didn't reply in time",
								code: 4
							});
							delete apiObjs[job["data"]["request"]];
						}

					});
				}
				catch (err) {
					console.log("Failed to get job data for the failed job");
				}
			}


			botData[x2]["busy"] = 0;
			botData[x2]["childid"] = -1;

			break;
		}
	}
});


/*
Restarts the queue
*/
function restart_queue() {

	/*
	kue job failed handlers
	*/

  	queue.process('floatlookup', bot_number, function(job, ctx, done){
	    // try to find an open bot
	    bot_found = null;
	    bot_index = -1;

	    for(var x = 0; x < bot_number; x++) {
	      	if (botData[x]["busy"] == 0 && botData[x]["ready"] == 1) {

	        	var bot_found = botData[x]["obj"];
	        	botData[x]["doneobj"] = done;

	        	botData[x]["childid"] = job.id;
				botData[x]["requested"] = new Date().getTime();
				botData[x]["busy"] = 1;

	        	var bot_index = x;

	        	break;
	      	}
	    }
	    if (bot_found != null) {
	      	// follow through with sending the request
	      	console.log("Sending request to " + bot_index + " with a job id of " + job.id);

	      	var data = job["data"];
	      	bot_found.send(['floatrequest', data, done]);
	    }
	    else {
	      	console.log("There is no bot to fullfill this request, they must be down.");
	    }
	});
}

// Login the bots
for(var x = 0; x < bot_number; x++) {
  	botData[x]["obj"].send(['login']);
}

//kue.app.listen(2999);
