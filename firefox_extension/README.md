# CSGOFloat Market Checker Firefox Extension

[You can find the extension on Firefox Add-ons here] (https://addons.mozilla.org/en-US/firefox/addon/csgofloat/)

# Features

* Allows you to retrieve the "float" and paint seed of any market item in one click
* You can fetch all floats on the current page
* When using pagination, the float data is saved

# Compatibility:
* This extension has been tested to work with Steam Inventory Helper and Enhanced Steam
* Since this extension doesn't hook and modify HTTP headers to bypass steamcommunity.com CSP, it should have greater compatibility.

In order to bypass CSP, the extension uses page event listeners to communicate with the content script and injected DOM content.

# Changelog

v1.0.0
* Initial release

v1.0.1
* Implemented support for requesting all floats on the given page

v1.0.2
* Added "Fetching" status to the "Get Float" button when that item is being processed
* Cleaned up the code w/ better commenting
