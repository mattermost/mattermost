// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

const CHANGE_EVENT = 'change';

class PreferenceStoreClass extends EventEmitter {
    constructor() {
        super();

        this.handleEventPayload = this.handleEventPayload.bind(this);
        this.dispatchToken = AppDispatcher.register(this.handleEventPayload);

        this.preferences = new Map();
    }

    getKey(category, name) {
        return `${category}--${name}`;
    }

    get(category, name, defaultValue = '') {
        const key = this.getKey(category, name);

        if (!this.preferences.has(key)) {
            return defaultValue;
        }

        return this.preferences.get(key);
    }

    getBool(category, name, defaultValue = false) {
        const key = this.getKey(category, name);

        if (!this.preferences.has(key)) {
            return defaultValue;
        }

        return this.preferences.get(key) !== 'false';
    }

    getInt(category, name, defaultValue = 0) {
        const key = this.getKey(category, name);

        if (!this.preferences.has(key)) {
            return defaultValue;
        }

        return parseInt(this.preferences.get(key), 10);
    }

    getCategory(category) {
        const prefix = category + '--';

        const preferences = new Map();

        for (const [key, value] of this.preferences) {
            if (key.startsWith(prefix)) {
                preferences.set(key.substring(prefix.length), value);
            }
        }

        return preferences;
    }

    setPreference(category, name, value) {
        this.preferences.set(this.getKey(category, name), value);
    }

    setPreferencesFromServer(newPreferences) {
        for (const preference of newPreferences) {
            this.setPreference(preference.category, preference.name, preference.value);
        }
    }

    clear() {
        this.preferences.clear();
    }

    emitChange(category) {
        this.emit(CHANGE_EVENT, category);
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.RECEIVED_PREFERENCE: {
            const preference = action.preference;
            this.setPreference(preference.category, preference.name, preference.value);
            this.emitChange(preference.category);
            break;
        }
        case ActionTypes.RECEIVED_PREFERENCES:
            this.setPreferencesFromServer(action.preferences);
            this.emitChange();
            break;
        }
    }
}

const PreferenceStore = new PreferenceStoreClass();
export default PreferenceStore;
global.window.PreferenceStore = PreferenceStore;
