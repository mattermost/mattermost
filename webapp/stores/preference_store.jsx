// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

const CHANGE_EVENT = 'change';

import store from 'stores/redux_store.jsx';
import * as Selectors from 'mattermost-redux/selectors/entities/preferences';
import {PreferenceTypes} from 'mattermost-redux/action_types';

class PreferenceStore extends EventEmitter {
    constructor() {
        super();

        this.handleEventPayload = this.handleEventPayload.bind(this);
        this.dispatchToken = AppDispatcher.register(this.handleEventPayload);

        this.preferences = new Map();
        this.entities = Selectors.getMyPreferences(store.getState());
        Object.keys(this.entities).forEach((key) => {
            this.preferences.set(key, this.entities[key].value);
        });

        store.subscribe(() => {
            const newEntities = Selectors.getMyPreferences(store.getState());
            if (this.entities !== newEntities) {
                this.preferences = new Map();
                Object.keys(newEntities).forEach((key) => {
                    this.preferences.set(key, newEntities[key].value);
                });
                this.emitChange();
            }

            this.entities = newEntities;
        });

        this.setMaxListeners(600);
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

    getObject(category, name, defaultValue = null) {
        const key = this.getKey(category, name);

        if (!this.preferences.has(key)) {
            return defaultValue;
        }

        return JSON.parse(this.preferences.get(key));
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
        store.dispatch({
            type: PreferenceTypes.RECEIVED_PREFERENCES,
            data: [{category, name, value}]
        });
    }

    setPreferencesFromServer(newPreferences) {
        store.dispatch({
            type: PreferenceTypes.RECEIVED_PREFERENCES,
            data: newPreferences
        });
    }

    deletePreference(preference) {
        store.dispatch({
            type: PreferenceTypes.DELETED_PREFERENCES,
            data: [preference]
        });
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

    getTheme(teamId) {
        if (this.preferences.has(this.getKey(Constants.Preferences.CATEGORY_THEME, teamId))) {
            return this.getObject(Constants.Preferences.CATEGORY_THEME, teamId);
        }

        if (this.preferences.has(this.getKey(Constants.Preferences.CATEGORY_THEME, ''))) {
            return this.getObject(Constants.Preferences.CATEGORY_THEME, '');
        }

        return Constants.THEMES.default;
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
        case ActionTypes.DELETED_PREFERENCES:
            for (const preference of action.preferences) {
                this.deletePreference(preference);
            }
            this.emitChange();
            break;
        case ActionTypes.CLICK_CHANNEL:
            this.setPreference(action.team_id, 'channel', action.id);
            break;
        }
    }
}

global.PreferenceStore = new PreferenceStore();
export default global.PreferenceStore;
