var engine = require('ejs-mate'),
	express = require('express'),
	bodyParser = require('body-parser'),
    http = require('http'),
    https = require('https'),
    kue = require('kue'),
    queue = kue.createQueue(),
    cp = require('child_process'),
    dbhandler = require('./dbhandler.js');

user_pass_info = [{"user": "", "pass": "", "auth":"", "index": 0}];

bot_number = user_pass_info.length;

// Stores the state of the bot (whether it is in csgo or not)
bots_ready = [];

// If the busy val is 0, then the bot is ready to process data
bots_busy = [];

for(var i = 0; i < bot_number; i++) {
  // Make the dynamic array size
  bots_ready.push(0);
  bots_busy.push(1);
}


// store the objects of the children to interface with
child_objects = [];

// stores the current job id of each child process
child_job_id = [];

// stores callback done objects for the finished processes
done_objects = [];

// Stores users that have requests currently in the bot

// Create the child processes that handle the communication to Valve
for(var x = 0; x < bot_number; x++) {
  cur_login = user_pass_info[x];
  console.log("Creating child process for " + cur_login["user"]);
  newchild = cp.fork('./child', [JSON.stringify(cur_login, null, 2)]);

  newchild.on('message', function(m) {
    
    if (m[0] == "ready") {
      console.log("bot is ready");
      // send request to get a float value
      bots_ready[m[1]] = 1;
      bots_busy[m[1]] = 0;
      console.log(bots_ready);
      if (bots_ready.indexOf(0) == -1) {
        // ready to send out requests
        console.log("Bots are ready to accept requests");
        resetQueue();
      }
    }
    else if (m[0] == "genericmsg") {
    	io.to(m[3]).emit(m[1], m[2]);
    }
    else if (m[0] == "itemdata") {
    	done_objects[m[1]]();
    	bots_busy[m[1]] = 0;
    	console.log(m[4]);
    	console.log(m[2]);

    	dbhandler.insertFloat(m[3]["iteminfo"], function (err, result) {
    		if (!err) {
    			console.log("Inserted float into db");
    		}
    		if (m[2] != null) {
	    		io.to(m[2]).emit("floatmessage", m[3]);

	    		// found out ip and remove it
	    		var socketip = io.sockets.connected[m[2]].request.connection.remoteAddress;
	    		if (socketip in apiObjs) {
	    			delete apiObjs[socketip];
	    		}
	    	}
	    	else if (m[4] != null) {
	    		console.log("Sending web api");
	    		if (apiObjs[m[4]] != undefined) {
	    			apiObjs[m[4]].json(m[3]);
	    		}
	    		delete apiObjs[m[4]];
	    	}
    	});
    }
    else if (m[0] == "unready") {
      console.log("Bot " + m[0] + " is not ready");
      bots_ready[m[1]] = 0;

    }
    else if (m[0] == "ready_again") {
      // avoids a call to starting up the queue again, when the bot was disconnected and now is being reconnected
      console.log("Bot " + m[0] + " is ready again");
      bots_ready[m[1]] = 1;
      bots_busy[m[1]] = 0;
    }
  });

  // Store the bot in an object
  child_objects[x] = newchild;
}

var app = express();
app.engine('ejs', engine);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(bodyParser());
app.use(express.static(__dirname + '/public'));

var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(1738);


var apiObjs = {};

app.get('/', function(req, res){
    res.render('index');
});

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


app.get('/api', function(req, res) {

	if (("a" in req.query && "d" in req.query && ("s" in req.query || "m" in req.query)) || "url" in req.query) {
		if ("m" in req.query) {
			req.query.s = "0";
		}
		else {
			req.query.m = "0";
		}


		if ("url" in req.query) {
			var inspectURL = req.query.url;
		}
		else {
			var inspectURL = buildInspectURL(req.query);
		}

		console.log(inspectURL);

		var lookupVars = parseLookupText(inspectURL);
		console.log(lookupVars);
		if (lookupVars != false) {
			dbhandler.checkInserted(lookupVars, function (err, result) {
				if (result != false) {
					res.json({iteminfo: result});
				}
				else {
					console.log("Not in DB, putting in queue");

					var userIP = req.connection.remoteAddress;

					if (!(userIP in apiObjs)) {
						apiObjs[userIP] = res;
						create_job(false, userIP, lookupVars, false);
					}
					else {
						res.status(500).json({error: "You may only have one pending request at a time", code:3});
					}
				}
			});

		}
		else {
			res.status(500).json({error: "Invalid Inspect Link Structure, please see the API docs.", code:2});
		}
	}
	else {
		res.status(500).json({error: "Improper Parameter Structure, please see the API docs.", code:1});
	}
});


function LookupHandler(link, socket) {
	lookupVars = parseLookupText(link);

	if (lookupVars != false) {
		console.log(lookupVars);

		dbhandler.checkInserted(lookupVars, function (err, result) {
			if (result != false) {
				socket.emit("floatmessage", {iteminfo: result});
			}
			else {
				var socketip = socket.request.connection.remoteAddress;
				if (socketip in apiObjs) {
					socket.emit('errormessage', "You may only have one pending request at a time");
				}
				else {
					create_job(socket, false, lookupVars, false);
					apiObjs[socketip] = true;
				}
			}
		});
	}
	else {
		socket.emit('errormessage', "We couldn't parse the inspect link, are you sure it is correct?")
	}


}


function parseLookupText(link) {
	// For the API, + signs get converted to a space in Express, so we account for that
	var regexed = link.match(/steam:\/\/rungame\/730\/\d*\/[+ ]csgo_econ_action_preview [SM]\d*[A]\d*[D]\d*/g);

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
		        svar = "0"
		        mvar = "0"
		        dvar = d[1]
		        avar = a[1]

		        // Process whether this is from a market or inventory item
		        if (lookup_type[1] == "M") {
		          	mvar = variable_type[1];
		        }
		        else {
		          	svar = variable_type[1];
		        }

		        returnVars = [svar, avar, dvar, mvar];
	      	}
	    }
	}

	return returnVars;
}


function create_job(socket, request, LookupVars, market) {
	// Support for http and websockets

  // Create job with TTL of 3000, it will be considered a fail if a child process
  // doesn't return a value within 3sec
  // 3 attempts

  var job = queue.create('floatlookup', {
    socketid: socket.id,
    request: request,
    s: LookupVars[0],
    a: LookupVars[1],
    d: LookupVars[2],
    m: LookupVars[3],
    market: market
  }).ttl(3000).attempts(3).removeOnComplete(true).save(function (err) {
      if (err) {
      	console.log("There was an error adding the job to the queue")
      	console.log(err)
      	if (socket != false) {
      		socket.emit("errormessage", "There was an error adding the job to the queue");
      	}
      }
    });
}

function resetQueue() {

	io.on('connection', function (socket) {
	  	socket.emit('joined');
	  	socket.emit('infomessage', 'You no longer have to login! Have fun!');

	  	socket.on('lookup', function(link){
	  		LookupHandler(link, socket);
	    });
	});

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

	/*

	    // remove the completed jobs from memory (redis) since they are already in the db

	    // this is done instead of removeoncomplete since that parameter seems to cause the
	    // attempts parameter to break

	    queue.complete( function( err, ids ) { // others are active, complete, failed, delayed
	      	ids.forEach( function( id ) {
	        	try {
	          		kue.Job.get(id, function (err, job) {
	            		if (job != undefined) {
	              			job.remove();
	            		}
	          		});
	        	}
	        	catch (err) {
	          		console.log("Failed to obtain job when parsing complete jobs")
	        	}
	      	});
	    });
  	}, 2000);
*/

	restart_queue();
}

queue.on('job error', function(id, err){
    console.log("Job error " + err);
    // There was a timeout of 3sec, reset the bots busy state

    // Find which bot was handling this request
    if (err == "TTL exceeded") {
      console.log("FAILED ATTEMPT for " + id);
      for(var x2 = 0; x2 < bot_number; x2++) {
        if (id == child_job_id[x2]) {
          // found the index of the bot, change the status
          console.log("found bot to reset value " + x2);

          bots_busy[x2] = 0;
          
          child_job_id[x2] = -1;

          // Commented out the following line since Kue doesn't properly handle more attempts if done is called
          //done_objects[x2]();
          break;
        }
      }

    }
    else {
      console.log("Queue Error: " + err);
    }
});


queue.on('job failed', function(id, errorMessage){
	// There were 3 timeouts, reset the bots busy state
	console.log("THREE FAILED ATTEMPTS");
	// At this point, the program will assume the user sent 
	// an invalid request, change the db info to reflect that
	for(var x1 = 0; x1 < bot_number; x1++) {
	  if (id == child_job_id[x1]) {
	    // found the index of the bot, change the status

	    bots_busy[x1] = 0;
	    //done_objects[x2]();
	    break;
	  }
	}
	try {
	  kue.Job.get(id, function (err, job) {
	  	console.log(job["data"]["socketid"]);
	  	console.log(job["data"]["request"]);
	    if (job["data"]["socketid"] != undefined) {
	    	io.to(job["data"]["socketid"]).emit("errormessage", "We couldn't retrieve the item data, are you sure you inputted the correct inspect link?");
	    	var socketip = io.sockets.connected[job["data"]["socketid"]].request.connection.remoteAddress;
    		if (socketip in apiObjs) {
    			delete apiObjs[socketip];
    		}
	    }
	    else if (job["data"]["request"] != undefined) {
	    	apiObjs[job["data"]["request"]].status(500).json({error: "Valve's servers didn't reply", code: 4});
	    	delete apiObjs[job["data"]["request"]];
	    }
	  });
	}
	catch (err) {
	  console.log("Failed to get job data for the failed job");
	}
});



function restart_queue() {

  	queue.process('floatlookup', bot_number, function(job, ctx, done){
	    // try to find an open bot
	    bot_found = null;
	    bot_index = -1;

	    console.log(bots_busy);

	    for(var x = 0; x < bot_number; x++) {
	      if (bots_busy[x] == 0 && bots_ready[x] == 1) {

	        bot_found = child_objects[x];
	        done_objects[x] = done;

	        child_job_id[x] = job.id;
	        bot_index = x;
	        bots_busy[x] = 1;

	        break;
	      }
	    }
	    if (bot_found != null) {
	      // follow through with sending the request
	      console.log("sending request to " + bot_index + " job id of " + job.id);

	      data = job["data"];
	      child_objects[bot_index].send(['floatrequest', data, done]);
	    }
	    else {
	      console.log("There is no bot to fullfill this request, this might be because a bot went down, checking now...");

	      // check how many bots have a "ready" tag, if it is less than the worker_amt, we should pause this worker
	      var current_bots_active = 0;
	      for (var x = 0; x < bot_number; x++) {
	        if (bots_ready[x] == 1) {
	          current_bots_active += 1;
	        }
	      }

	      if (current_bots_active < bot_number) {
	        console.log("A bot went down, going to try to restart the queue");
	        io.emit('errormessage', "Valve's servers seem to be down, please wait");
	        // keep on checking periodically whether the bot is ready yet, so we can resume this worker
	        // if not, this one worker will just be paused indefinitely
	        queue.shutdown(5000, function(err) {
	          var restart_timer = setInterval(function(){ 
	            var bots_active_timeout = 0;
	            for (var x = 0; x < bot_number; x++) {
	              if (bots_ready[x] == 1) {
	                bots_active_timeout += 1;
	              }
	            }
	            if (bots_active_timeout == bot_number) {
	              // there are more bots ready than current workers processing, resume this worker
	              console.log("Restarting the queue since the bots are back");
	              io.emit('successmessage', "Valve's servers are back up!");
	              // clear this setinterval and restart the queue
	              clearInterval(restart_timer);
	              restart_queue();
	            }
	          }, 5000);
	        });
	      }
	    }
	});
}


// time to login the bots
for(var x = 0; x < bot_number; x++) {
  child_objects[x].send(['login']);
}
