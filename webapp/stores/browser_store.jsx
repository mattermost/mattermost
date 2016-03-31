// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {generateId} from 'utils/utils.jsx';

function getPrefix() {
    if (global.window.mm_current_user_id) {
        return global.window.mm_current_user_id + '_';
    }

    console.warn('BrowserStore tried to operate without user present'); //eslint-disable-line no-console

    return 'unknown_';
}

class BrowserStoreClass {
    constructor() {
        this.getItem = this.getItem.bind(this);
        this.setItem = this.setItem.bind(this);
        this.removeItem = this.removeItem.bind(this);
        this.setGlobalItem = this.setGlobalItem.bind(this);
        this.getGlobalItem = this.getGlobalItem.bind(this);
        this.removeGlobalItem = this.removeGlobalItem.bind(this);
        this.actionOnItemsWithPrefix = this.actionOnItemsWithPrefix.bind(this);
        this.actionOnGlobalItemsWithPrefix = this.actionOnGlobalItemsWithPrefix.bind(this);
        this.isLocalStorageSupported = this.isLocalStorageSupported.bind(this);
        this.getLastServerVersion = this.getLastServerVersion.bind(this);
        this.setLastServerVersion = this.setLastServerVersion.bind(this);
        this.clear = this.clear.bind(this);
        this.clearAll = this.clearAll.bind(this);
        this.checkedLocalStorageSupported = '';
        this.signalLogout = this.signalLogout.bind(this);
        this.isSignallingLogout = this.isSignallingLogout.bind(this);
        this.signalLogin = this.signalLogin.bind(this);
        this.isSignallingLogin = this.isSignallingLogin.bind(this);
    }

    setItem(name, value) {
        this.setGlobalItem(getPrefix() + name, value);
    }

    getItem(name, defaultValue) {
        return this.getGlobalItem(getPrefix() + name, defaultValue);
    }

    removeItem(name) {
        this.removeGlobalItem(getPrefix() + name);
    }

    setGlobalItem(name, value) {
        try {
            if (this.isLocalStorageSupported()) {
                localStorage.setItem(name, JSON.stringify(value));
            } else {
                sessionStorage.setItem(name, JSON.stringify(value));
            }
        } catch (err) {
            console.log('An error occurred while setting local storage, clearing all props'); //eslint-disable-line no-console
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload(true);
        }
    }

    getGlobalItem(name, defaultValue) {
        var result = null;
        try {
            if (this.isLocalStorageSupported()) {
                result = JSON.parse(localStorage.getItem(name));
            } else {
                result = JSON.parse(sessionStorage.getItem(name));
            }
        } catch (err) {
            result = null;
        }

        if (result === null && typeof defaultValue !== 'undefined') {
            result = defaultValue;
        }

        return result;
    }

    removeGlobalItem(name) {
        if (this.isLocalStorageSupported()) {
            localStorage.removeItem(name);
        } else {
            sessionStorage.removeItem(name);
        }
    }

    getLastServerVersion() {
        return this.getGlobalItem('last_server_version');
    }

    setLastServerVersion(version) {
        this.setGlobalItem('last_server_version', version);
    }

    signalLogout() {
        if (this.isLocalStorageSupported()) {
            // PLT-1285 store an identifier in session storage so we can catch if the logout came from this tab on IE11
            const logoutId = generateId();

            sessionStorage.setItem('__logout__', logoutId);
            localStorage.setItem('__logout__', logoutId);
            localStorage.removeItem('__logout__');
        }
    }

    isSignallingLogout(logoutId) {
        return logoutId === sessionStorage.getItem('__logout__');
    }

    signalLogin() {
        if (this.isLocalStorageSupported()) {
            // PLT-1285 store an identifier in session storage so we can catch if the logout came from this tab on IE11
            const loginId = generateId();

            sessionStorage.setItem('__login__', loginId);
            localStorage.setItem('__login__', loginId);
            localStorage.removeItem('__login__');
        }
    }

    isSignallingLogin(loginId) {
        return loginId === sessionStorage.getItem('__login__');
    }

    /**
     * Preforms the given action on each item that has the given prefix
     * Signature for action is action(key, value)
     */
    actionOnGlobalItemsWithPrefix(prefix, action) {
        var storage = sessionStorage;
        if (this.isLocalStorageSupported()) {
            storage = localStorage;
        }

        for (var key in storage) {
            if (key.lastIndexOf(prefix, 0) === 0) {
                action(key, this.getGlobalItem(key));
            }
        }
    }

    actionOnItemsWithPrefix(prefix, action) {
        var globalPrefix = getPrefix();
        var globalPrefixiLen = globalPrefix.length;
        for (var key in sessionStorage) {
            if (key.lastIndexOf(globalPrefix + prefix, 0) === 0) {
                var userkey = key.substring(globalPrefixiLen);
                action(userkey, this.getGlobalItem(key));
            }
        }
    }

    clear() {
        // don't clear the logout id so IE11 can tell which tab sent a logout request
        const logoutId = sessionStorage.getItem('__logout__');

        sessionStorage.clear();
        localStorage.clear();

        if (logoutId) {
            sessionStorage.setItem('__logout__', logoutId);
        }
    }

    clearAll() {
        sessionStorage.clear();
        localStorage.clear();
    }

    isLocalStorageSupported() {
        if (this.checkedLocalStorageSupported !== '') {
            return this.checkedLocalStorageSupported;
        }

        try {
            sessionStorage.setItem('__testSession__', '1');
            sessionStorage.removeItem('__testSession__');

            localStorage.setItem('__testLocal__', '1');
            if (localStorage.getItem('__testLocal__') !== '1') {
                this.checkedLocalStorageSupported = false;
            }
            localStorage.removeItem('__testLocal__', '1');

            this.checkedLocalStorageSupported = true;
        } catch (e) {
            this.checkedLocalStorageSupported = false;
        }

        return this.checkedLocalStorageSupported;
    }
}

var BrowserStore = new BrowserStoreClass();
export default BrowserStore;
