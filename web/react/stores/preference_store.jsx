// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import BrowserStore from './browser_store.jsx';
import EventEmitter from 'events';
import UserStore from '../stores/user_store.jsx';

const CHANGE_EVENT = 'change';

function getPreferenceKey(category, name) {
    return `${category}-${name}`;
}

function getPreferenceKeyForModel(preference) {
    return `${preference.category}-${preference.name}`;
}

class PreferenceStoreClass extends EventEmitter {
    constructor() {
        super();

        this.getAllPreferences = this.getAllPreferences.bind(this);
        this.get = this.get.bind(this);
        this.getBool = this.getBool.bind(this);
        this.getInt = this.getInt.bind(this);
        this.getPreference = this.getPreference.bind(this);
        this.getCategory = this.getCategory.bind(this);
        this.getPreferencesWhere = this.getPreferencesWhere.bind(this);
        this.setAllPreferences = this.setAllPreferences.bind(this);
        this.setPreference = this.setPreference.bind(this);

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);

        this.handleEventPayload = this.handleEventPayload.bind(this);
        this.dispatchToken = AppDispatcher.register(this.handleEventPayload);
    }

    getAllPreferences() {
        return new Map(BrowserStore.getItem('preferences', []));
    }

    get(category, name, defaultValue = '') {
        const preference = this.getAllPreferences().get(getPreferenceKey(category, name));

        if (!preference) {
            return defaultValue;
        }

        return preference.value || defaultValue;
    }

    getBool(category, name, defaultValue = false) {
        const preference = this.getAllPreferences().get(getPreferenceKey(category, name));

        if (!preference) {
            return defaultValue;
        }

        // prevent a non-false default value from being returned instead of an actual false value
        if (preference.value === 'false') {
            return false;
        }

        return (preference.value !== 'false') || defaultValue;
    }

    getInt(category, name, defaultValue = 0) {
        const preference = this.getAllPreferences().get(getPreferenceKey(category, name));

        if (!preference) {
            return defaultValue;
        }

        // prevent a non-zero default value from being returned instead of an actual 0 value
        if (preference.value === '0') {
            return 0;
        }

        return parseInt(preference.value, 10) || defaultValue;
    }

    getPreference(category, name, defaultValue = {}) {
        return this.getAllPreferences().get(getPreferenceKey(category, name)) || defaultValue;
    }

    getCategory(category) {
        return this.getPreferencesWhere((preference) => (preference.category === category));
    }

    getPreferencesWhere(pred) {
        const all = this.getAllPreferences();
        const preferences = [];

        for (const [, preference] of all) {
            if (pred(preference)) {
                preferences.push(preference);
            }
        }

        return preferences;
    }

    setAllPreferences(preferences) {
        // note that we store the preferences as an array of key-value pairs so that we can deserialize
        // it as a proper Map instead of an object
        BrowserStore.setItem('preferences', [...preferences]);
    }

    setPreference(category, name, value) {
        const preferences = this.getAllPreferences();

        const key = getPreferenceKey(category, name);
        let preference = preferences.get(key);

        if (!preference) {
            preference = {
                user_id: UserStore.getCurrentId(),
                category,
                name
            };
        }
        preference.value = value;

        preferences.set(key, preference);

        this.setAllPreferences(preferences);

        return preference;
    }

    setPreferences(newPreferences) {
        const preferences = this.getAllPreferences();

        for (const preference of newPreferences) {
            preferences.set(getPreferenceKeyForModel(preference), preference);
        }

        this.setAllPreferences(preferences);
    }

    emitChange() {
        this.emit(CHANGE_EVENT);
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
        case ActionTypes.RECIEVED_PREFERENCE: {
            const preference = action.preference;
            this.setPreference(preference.category, preference.name, preference.value);
            this.emitChange();
            break;
        }
        case ActionTypes.RECIEVED_PREFERENCES:
            this.setPreferences(action.preferences);
            this.emitChange();
            break;
        }
    }
}

const PreferenceStore = new PreferenceStoreClass();
export default PreferenceStore;
window.PreferenceStore = PreferenceStore;
