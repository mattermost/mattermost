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
        this.getPreference = this.getPreference.bind(this);
        this.getPreferences = this.getPreferences.bind(this);
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

    getPreference(category, name, defaultValue = '') {
        return this.getAllPreferences().get(getPreferenceKey(category, name)) || defaultValue;
    }

    getPreferences(category) {
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
        case ActionTypes.RECIEVED_PREFERENCES: {
            const preferences = this.getAllPreferences();

            for (const preference of action.preferences) {
                preferences.set(getPreferenceKeyForModel(preference), preference);
            }

            this.setAllPreferences(preferences);
            this.emitChange();
            break;
        }
        }
    }
}

const PreferenceStore = new PreferenceStoreClass();
export default PreferenceStore;
window.PreferenceStore = PreferenceStore;
