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

class BrowserStoreClass {
    constructor() {
        this.getItem = this.getItem.bind(this);
        this.setItem = this.setItem.bind(this);
        this.removeItem = this.removeItem.bind(this);
        this.setGlobalItem = this.setGlobalItem.bind(this);
        this.getGlobalItem = this.getGlobalItem.bind(this);
        this.removeGlobalItem = this.removeGlobalItem.bind(this);
        this.clear = this.clear.bind(this);
        this.actionOnItemsWithPrefix = this.actionOnItemsWithPrefix.bind(this);
        this.isLocalStorageSupported = this.isLocalStorageSupported.bind(this);

        var currentVersion = localStorage.getItem('local_storage_version');
        if (currentVersion !== BROWSER_STORE_VERSION) {
            this.clear();
            localStorage.setItem('local_storage_version', BROWSER_STORE_VERSION);
        }
    }

    getItem(name, defaultValue) {
        return this.getGlobalItem(getPrefix() + name, defaultValue);
    }

    setItem(name, value) {
        this.setGlobalItem(getPrefix() + name, value);
    }

    removeItem(name) {
        localStorage.removeItem(getPrefix() + name);
    }

    setGlobalItem(name, value) {
        localStorage.setItem(name, JSON.stringify(value));
    }

    getGlobalItem(name, defaultValue) {
        var result = null;
        try {
            result = JSON.parse(localStorage.getItem(name));
        } catch (err) {
            result = null;
        }

        if (result === null && typeof defaultValue !== 'undefined') {
            result = defaultValue;
        }

        return result;
    }

    removeGlobalItem(name) {
        localStorage.removeItem(name);
    }

    clear() {
        localStorage.clear();
        sessionStorage.clear();
    }

    /**
     * Preforms the given action on each item that has the given prefix
     * Signature for action is action(key, value)
     */
    actionOnItemsWithPrefix(prefix, action) {
        var globalPrefix = getPrefix();
        var globalPrefixiLen = globalPrefix.length;
        for (var key in localStorage) {
            if (key.lastIndexOf(globalPrefix + prefix, 0) === 0) {
                var userkey = key.substring(globalPrefixiLen);
                action(userkey, this.getGlobalItem(key));
            }
        }
    }

    isLocalStorageSupported() {
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
}

var BrowserStore = new BrowserStoreClass();
export default BrowserStore;
