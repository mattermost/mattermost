// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';
import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';

class LocalizationStoreClass extends EventEmitter {
    constructor() {
        super();

        this.currentLocale = 'en';
        this.currentTranslations = null;
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

    setCurrentLocale(locale, translations) {
        this.currentLocale = locale;
        this.currentTranslations = translations;
    }

    getLocale() {
        return this.currentLocale;
    }

    getTranslations() {
        return this.currentTranslations;
    }
}

var LocalizationStore = new LocalizationStoreClass();
LocalizationStore.setMaxListeners(0);

LocalizationStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_LOCALE:
        LocalizationStore.setCurrentLocale(action.locale, action.translations);
        LocalizationStore.emitChange();
        break;
    default:
    }
});

export default LocalizationStore;
