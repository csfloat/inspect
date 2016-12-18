var ajax = new XMLHttpRequest();
var currentid = "";
var currenturl = "";

ajax.onreadystatechange = function() {
    if (ajax.readyState == 4) {
        if (ajax.status == 200) {
            // We got item info, parse it and send it to the DOM
            var json = JSON.parse(ajax.responseText);
            if ("iteminfo" in json) {
                window.postMessage({source: "contentscript", type: "success", iteminfo: json["iteminfo"],
                    id: currentid, host: "CSGOFloat"}, "*");
            }
        }
        else {
            // Send the error to the DOM
            window.postMessage({source: "contentscript", type: "error", error: JSON.parse(ajax.responseText),
                id: currentid, host: "CSGOFloat"}, "*");
        }
    }
};

// Event listener for this content script to handle communication to the DOM
window.addEventListener("message", function(event) {
    if(event.data.host &&
      (event.data.host === "CSGOFloat") && 
       event.data.source === "page"){
        var url = event.data.url;
        var id = event.data.id;

        currenturl = url;
        currentid = id;

        // Request the float info from the API
        ajax.open("GET", "https://api.csgofloat.com:1738/?url=" + url, true);
        ajax.send();
    }
}, false);

/*
    The functions with this function are injected into the DOM of the page
*/
function injectToDOM() {
    
    /*
        Tells the content script to retrieve the float for the given item

        This must be done through the content script in order to bypass CSP on the steamcommunity page without
        hooking the requests and changing the headers. Since only one extension can hook headers at a time, this
        prevents major compatability issues with other extensions.
    */
    function getCSGOFloat(url, id) {
        if (window.processingfloat == 0) {
            window.processingfloat = 1;
            changeButtonStatus(id, "Fetching");
            window.postMessage({source: "page", url: url, id: id, host: "CSGOFloat"}, "*");
        }
        else {
            var errorobj = {"error": "Already processing a float request"};
            processError(id, errorobj, false);
        }
    }

    /*
        Handles DOM communication to this content script
    */
    function bindWindowListener() {
        window.processingfloat = 0;

        window.addEventListener("message", function(event) {
            if (event.data.host &&
               (event.data.host === "CSGOFloat") && 
               event.data.source === "contentscript"){
                
                var itemid = event.data.id;

                if (event.data.type == "success") {
                    // We're no longer processing a float
                    window.processingfloat = 0;

                    // Add it to a dict holding the requested floats
                    floatdata[itemid] = event.data.iteminfo;

                    // Display it to the user
                    processSuccess(itemid);
                }
                else if (event.data.type == "error") {
                    // Display the error to the user
                    processError(itemid, event.data.error, true);
                }

                // If this is part of a queue, pop the last element (this request)
                if (window.floatQueue.length > 0) {
                    window.floatQueue.pop();
                }

                // If there are still items in the queue, request the next one
                if (window.floatQueue.length > 0) {
                    var queuelength = window.floatQueue.length;
                    
                    getCSGOFloat(window.floatQueue[queuelength-1][1], window.floatQueue[queuelength-1][0]);
                }
                else {
                    // There is no longer a queue, show the "Get all floats" button again
                    $J("#allfloatbutton").show();
                }
            }
        }, false);
    }

    /*
        Changes the "Get float" button for the specified itemid to the specified message
    */
    function changeButtonStatus(itemid, msg) {
        var floatdiv = $J("#" + itemid + "_floatdiv");
        if (floatdiv.length > 0) {
            floatdiv.find("#floatbutton").find("span").text(msg);
        }
    }

    /*
        Processes a successful float retrieval for the given itemid
    */
    function processSuccess(itemid) {
        // find the corresponding div
        var floatdiv = $J("#" + itemid + "_floatdiv");

        if (floatdiv.length > 0) {
            // Remove the "get float" button
            floatdiv.find("#floatbutton").remove();

            var msgdiv = floatdiv.find("#message");

            // Get the iteminfo for this itemid
            var iteminfo = floatdata[itemid];

            var data = "Float: " + iteminfo["floatvalue"] + "<br>Paint Seed: " + iteminfo["paintseed"];

            // Show the float and paint seed to the user
            msgdiv.html(data);
        }
    }

    /*
        Processes the error for a given itemid, allows you to specify whether the error caused no floats
        to be processing currently
    */
    function processError(itemid, error, resetProcessing) {
        // If this caused us to no longer process a float, reset the boolean
        if (resetProcessing) window.processingfloat = 0;

        // Change the button test for this itemid
        changeButtonStatus(itemid, "Get Float");

        // Change the message div for this item to the error
        var floatdiv = $J("#" + itemid + "_floatdiv");
        if (floatdiv.length > 0) {
            var msgdiv = floatdiv.find("#message");

            msgdiv.html(error["error"]);
        }
    }

    /*
        Adds the "Get all floats" button
    */
    function addAllFloatButton() {
        $J(".market_listing_header_namespacer")
            .after('<div style="float: right; margin-right: 2px; display: block;">' +
            '<div style="display: inline; margin-right: 10px;"><a href="https://github.com/Step7750/CSGOFloat">' +
            'Powered by CSGOFloat</a></div>' +
            '<a href="javascript:GetAllFloats()" class="btn_green_white_innerfade btn_small" id="allfloatbutton"><span>' +
            'Get All Floats</span></a></div>')
    }

    /*
        Puts all of the available items on the page into a queue for float retrieval
    */
    function GetAllFloats() {
        // Get all current items on the page (in proper order)
        $J($J(".market_listing_row.market_recent_listing_row").get().reverse()).each(function( index ) {
            // Get the item of this item
            var id = $J(this).attr("id").replace("listing_", "");

            var listingdata = g_rgListingInfo[id];

            // Make sure we don't already have the float for this item
            // Make sure it is a CSGO item (appid == 730)
            if (listingdata["asset"]["appid"] == 730 && !(id in floatdata)) {

                // Find the listing div
                var nameid = "#listing_" + id + "_name";
                var listingname = $J(this).find(nameid);
                
                // Check if there is an inspect link for this item
                if ("market_actions" in listingdata["asset"]) {

                    // Make sure we found the div and that there is an item in market_actions
                    if (listingname.length > 0 && listingdata["asset"]["market_actions"].length > 0) {

                        // Obtain and format the inspect link
                        var inspectlink = listingdata["asset"]["market_actions"][0]["link"];
                        inspectlink = inspectlink.replace("%listingid%", id).replace("%assetid%", listingdata["asset"]["id"]);
                        
                        // Add the item to the queue
                        window.floatQueue.push([id, inspectlink]);
                        
                    }
                }
            }
        });
    
        // If we put any items in the queue, remove the "Get all floats" button and start the queue
        if (window.floatQueue.length > 0) {

            $J("#allfloatbutton").hide();
            var queuelength = window.floatQueue.length;

            // Get the last item
            getCSGOFloat(window.floatQueue[queuelength-1][1], window.floatQueue[queuelength-1][0]);
        }
    }

    /*
        If an item on the current page doesn't have the float div/buttons, this function adds it
    */
    function addButtons() {
        // Track how many items we manipulated the DOM of
        var itemamount = 0;

        // Iterate through each item on the page
        $J(".market_listing_row.market_recent_listing_row").each(function( index ) {

            // Get the id and listing data for it
            var id = $J(this).attr("id").replace("listing_", "");

            var listingdata = g_rgListingInfo[id];

            // Make sure it is a CSGO item
            if (listingdata["asset"]["appid"] == 730) {

                // Find the div for this item
                var nameid = "#listing_" + id + "_name";
                var listingname = $J(this).find(nameid);

                // Make sure it has an inspect link
                if ("market_actions" in listingdata["asset"]) {
                    if (listingname.length > 0 && listingdata["asset"]["market_actions"].length > 0) {

                        // Obtain and format the inspect link
                        var inspectlink = listingdata["asset"]["market_actions"][0]["link"];
                        inspectlink = inspectlink.replace("%listingid%", id).replace("%assetid%", listingdata["asset"]["id"]);

                        // Make sure we didn't already add the button
                        if ($J(this).find("#" + id + "_floatdiv").length === 0) {

                            // Add the float div and button
                            var buttonhtml = '<div style="display:inline; text-align: left;" id="%id%_floatdiv">' +
                                '<a href="javascript:getCSGOFloat(\'%url%\', \'%id%\')" ' +
                                'class="btn_green_white_innerfade btn_small" id="floatbutton">' +
                                '<span>Get Float</span></a><div id="message"></div></div>';

                            buttonhtml = buttonhtml.replace("%url%", inspectlink).replace("%id%", id).replace("%id%", id);

                            listingname.parent().append(buttonhtml);

                            // check if we already have the float for this item
                            if (id in floatdata) {
                                processSuccess(id);
                            }
                            
                            itemamount += 1;
                        }
                    }
                }
                else {
                    // This page doesn't have weapons with inspect urls, clear the interval adding these buttons
                    clearInterval(floattimer);
                }

            }
        });

        // Add show all button if it doesn't exist and we have valid items
        if ($J("#allfloatbutton").length == 0 && itemamount > 0) {
            addAllFloatButton();
        }
    }

    // Inject the functions and global vars into the DOM
    addJS_Node(getCSGOFloat);
    addJS_Node(addButtons);
    addJS_Node(bindWindowListener);
    addJS_Node(processSuccess);
    addJS_Node(addAllFloatButton);
    addJS_Node(processError);
    addJS_Node(GetAllFloats);
    addJS_Node(changeButtonStatus);
    addJS_Node("window.floatQueue = [];");
    addJS_Node("window.floatdata = {};");

    // We want to make sure the items are updated if the page changes
    // Prevents us from overwriting the page change function to allow greater compatability with other extensions
    addJS_Node("var floattimer = setInterval(function(){addButtons();}, 500);");
    addJS_Node("bindWindowListener();");

    function addJS_Node (text, s_URL, funcToRun, runOnLoad) {
        var D                                   = document;
        var scriptNode                          = D.createElement ('script');
        if (runOnLoad) {
            scriptNode.addEventListener ("load", runOnLoad, false);
        }
        scriptNode.type                         = "text/javascript";
        if (text)       scriptNode.textContent  = text;
        if (s_URL)      scriptNode.src          = s_URL;
        if (funcToRun)  scriptNode.textContent  = '(' + funcToRun.toString() + ')()';

        var targ = D.getElementsByTagName ('head')[0] || D.body || D.documentElement;
        targ.appendChild (scriptNode);
    }

    console.log('%c CSGOFloat Market Checker (v1.0.2) by Step7750 ', 'background: #222; color: #fff;');
    console.log('%c Changelog can be found here: https://github.com/Step7750/CSGOFloat ', 'background: #222; color: #fff;');
}

// Inject the needed functions into the DOM
injectToDOM();