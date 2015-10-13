// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const ActionTypes = require('../utils/constants.jsx').ActionTypes;
const AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
const BrowserStore = require('./browser_store.jsx');
const EventEmitter = require('events').EventEmitter;
const UserStore = require('../stores/user_store.jsx');

const CHANGE_EVENT = 'change';

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

    getKey(category, name) {
        return `${category}-${name}`;
    }

    getKeyForModel(preference) {
        return `${preference.category}-${preference.name}`;
    }

    getAllPreferences() {
        return new Map(BrowserStore.getItem('preferences', []));
    }

    getPreference(category, name, defaultValue = '') {
        return this.getAllPreferences().get(this.getKey(category, name)) || defaultValue;
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

        const key = this.getKey(category, name);
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

    emitChange(preferences) {
        this.emit(CHANGE_EVENT, preferences);
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
        case ActionTypes.RECIEVED_PREFERENCES:
            const preferences = this.getAllPreferences();

            for (const preference of action.preferences) {
                preferences.set(this.getKeyForModel(preference), preference);
            }

            this.setAllPreferences(preferences);
            this.emitChange(preferences);
        }
    }
}

const PreferenceStore = new PreferenceStoreClass();
export default PreferenceStore;
