// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {AppBinding, AppCommandFormMap} from '@mattermost/types/apps';

import {AppsTypes} from 'mattermost-redux/action_types';
import {validateBindings} from 'mattermost-redux/utils/apps';

export function mainBindings(state: AppBinding[] = [], action: AnyAction): AppBinding[] {
    switch (action.type) {
    case AppsTypes.FAILED_TO_FETCH_APP_BINDINGS: {
        if (!state.length) {
            return state;
        }

        return [];
    }
    case AppsTypes.RECEIVED_APP_BINDINGS: {
        const bindings = action.data;
        return validateBindings(bindings);
    }
    case AppsTypes.APPS_PLUGIN_DISABLED: {
        if (!state.length) {
            return state;
        }

        return [];
    }
    default:
        return state;
    }
}

function mainForms(state: AppCommandFormMap = {}, action: AnyAction): AppCommandFormMap {
    switch (action.type) {
    case AppsTypes.RECEIVED_APP_BINDINGS:
        return {};
    case AppsTypes.RECEIVED_APP_COMMAND_FORM: {
        const {form, location} = action.data;
        const newState = {
            ...state,
            [location]: form,
        };
        return newState;
    }
    default:
        return state;
    }
}

const main = combineReducers({
    bindings: mainBindings,
    forms: mainForms,
});

function rhsBindings(state: AppBinding[] = [], action: AnyAction): AppBinding[] {
    switch (action.type) {
    case AppsTypes.RECEIVED_APP_RHS_BINDINGS: {
        const bindings = action.data;
        return validateBindings(bindings);
    }
    default:
        return state;
    }
}

function rhsForms(state: AppCommandFormMap = {}, action: AnyAction): AppCommandFormMap {
    switch (action.type) {
    case AppsTypes.RECEIVED_APP_RHS_BINDINGS:
        return {};
    case AppsTypes.RECEIVED_APP_RHS_COMMAND_FORM: {
        const {form, location} = action.data;
        const newState = {
            ...state,
            [location]: form,
        };
        return newState;
    }
    default:
        return state;
    }
}

const rhs = combineReducers({
    bindings: rhsBindings,
    forms: rhsForms,
});

export function pluginEnabled(state = true, action: AnyAction): boolean {
    switch (action.type) {
    case AppsTypes.APPS_PLUGIN_ENABLED: {
        return true;
    }
    case AppsTypes.APPS_PLUGIN_DISABLED: {
        return false;
    }
    case AppsTypes.RECEIVED_APP_BINDINGS: {
        return true;
    }
    case AppsTypes.FAILED_TO_FETCH_APP_BINDINGS: {
        return false;
    }

    default:
        return state;
    }
}

export default combineReducers({
    main,
    rhs,
    pluginEnabled,
});
