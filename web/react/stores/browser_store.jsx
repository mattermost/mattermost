// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore;
function getPrefix() {
    if (!UserStore) {
        UserStore = require('./user_store.jsx');
    }
    return UserStore.getCurrentId() + '_';
}

// Also change model/utils.go ETAG_ROOT_VERSION
var BROWSER_STORE_VERSION = '.5';

module.exports = {
    initialized: false,

    initialize: function() {
        var currentVersion = localStorage.getItem('local_storage_version');
        if (currentVersion !== BROWSER_STORE_VERSION) {
            this.clear();
            localStorage.setItem('local_storage_version', BROWSER_STORE_VERSION);
        }
        this.initialized = true;
    },

    getItem: function(name, defaultValue) {
        return this.getGlobalItem(getPrefix() + name, defaultValue);
    },

    setItem: function(name, value) {
        this.setGlobalItem(getPrefix() + name, value);
    },

    removeItem: function(name) {
        if (!this.initialized) {
            this.initialize();
        }

        localStorage.removeItem(getPrefix() + name);
    },

    setGlobalItem: function(name, value) {
        if (!this.initialized) {
            this.initialize();
        }

        localStorage.setItem(name, JSON.stringify(value));
    },

    getGlobalItem: function(name, defaultValue) {
        if (!this.initialized) {
            this.initialize();
        }

        var result = null;
        try {
            result = JSON.parse(localStorage.getItem(name));
        } catch (err) {}

        if (result === null && typeof defaultValue !== 'undefined') {
            result = defaultValue;
        }

        return result;
    },

    removeGlobalItem: function(name) {
        if (!this.initialized) {
            this.initialize();
        }

        localStorage.removeItem(name);
    },

    clear: function() {
        localStorage.clear();
        sessionStorage.clear();
    },

    /**
     * Preforms the given action on each item that has the given prefix
     * Signature for action is action(key, value)
     */
    actionOnItemsWithPrefix: function(prefix, action) {
        if (!this.initialized) {
            this.initialize();
        }

        var globalPrefix = getPrefix();
        var globalPrefixiLen = globalPrefix.length;
        for (var key in localStorage) {
            if (key.lastIndexOf(globalPrefix + prefix, 0) === 0) {
                var userkey = key.substring(globalPrefixiLen);
                action(userkey, this.getGlobalItem(key));
            }
        }
    },

    isLocalStorageSupported: function() {
        try {
            sessionStorage.setItem('testSession', '1');
            sessionStorage.removeItem('testSession');

            localStorage.setItem('testLocal', '1');
            if (localStorage.getItem('testLocal') !== '1') {
                return false;
            }
            localStorage.removeItem('testLocal', '1');

            return true;
        } catch (e) {
            return false;
        }
    }
};
