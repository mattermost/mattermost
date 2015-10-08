// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore;
function getPrefix() {
    if (!UserStore) {
        UserStore = require('./user_store.jsx'); //eslint-disable-line global-require
    }
    return UserStore.getCurrentId() + '_';
}

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
        if (currentVersion !== global.window.config.Version) {
            this.clear();
            localStorage.setItem('local_storage_version', global.window.config.Version);
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
        try {
            localStorage.setItem(name, JSON.stringify(value));
        } catch (err) {
            console.log('An error occurred while setting local storage, clearing all props'); //eslint-disable-line no-console
            localStorage.clear();
            window.location.href = window.location.href;
        }
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
