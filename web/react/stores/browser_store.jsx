// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var BROWSER_STORE_VERSION = '.1';

module.exports.initalize = function() {
	var currentVersion = localStorage.getItem("local_storage_version");
	if (currentVersion !== BROWSER_STORE_VERSION) {
		localStorage.clear();
		sessionStorage.clear();
		localStorage.setItem("local_storage_version", BROWSER_STORE_VERSION);
	}
}

module.exports.setItem = function(name, value) {
	var user_id = UserStore.getCurrentId();
	localStorage.setItem(user_id + "_" + name, value);
};

module.exports.getItem = function(name) {
	var user_id = UserStore.getCurrentId();
	return localStorage.getItem(user_id + "_" + name);
};

module.exports.removeItem = function(name) {
	var user_id = UserStore.getCurrentId();
	localStorage.removeItem(user_id + "_" + name);
};

module.exports.clear = function() {
	localStorage.clear();
	sessionStorage.clear();
};

// Preforms the given action on each item that has the given prefix
// Signiture for action is action(key, value)
module.exports.actionOnItemsWithPrefix = function (prefix, action) {
	var user_id = UserStore.getCurrentId();
	var id_len = user_id.length;
	var prefix_len = prefix.length;
    for (key in localStorage) {
        if (key.substring(id_len, id_len + prefix_len) === prefix) {
			var userkey = key.substring(id_len);
			action(userkey, BrowserStore.getItem(key));
        }
    }
};
