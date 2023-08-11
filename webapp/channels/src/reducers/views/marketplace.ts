// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {MarketplaceApp, MarketplacePlugin} from '@mattermost/types/marketplace';

import {UserTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {ActionTypes, ModalIdentifiers} from 'utils/constants';

// plugins tracks the set of marketplace plugins returned by the server
function plugins(state: MarketplacePlugin[] = [], action: GenericAction): MarketplacePlugin[] {
    switch (action.type) {
    case ActionTypes.RECEIVED_MARKETPLACE_PLUGINS:
        return action.plugins ? action.plugins : [];

    case ActionTypes.MODAL_CLOSE:
        if (action.modalId !== ModalIdentifiers.PLUGIN_MARKETPLACE) {
            return state;
        }

        return [];

    case UserTypes.LOGOUT_SUCCESS:
        return [];
    default:
        return state;
    }
}

// apps tracks the set of marketplace apps returned by the apps plugin
function apps(state: MarketplaceApp[] = [], action: GenericAction): MarketplaceApp[] {
    switch (action.type) {
    case ActionTypes.RECEIVED_MARKETPLACE_APPS:
        return action.apps ? action.apps : [];

    case ActionTypes.MODAL_CLOSE:
        if (action.modalId !== ModalIdentifiers.PLUGIN_MARKETPLACE) {
            return state;
        }

        return [];

    case UserTypes.LOGOUT_SUCCESS:
        return [];
    default:
        return state;
    }
}

// installing tracks the items pending installation
function installing(state: {[id: string]: boolean} = {}, action: GenericAction): {[id: string]: boolean} {
    switch (action.type) {
    case ActionTypes.INSTALLING_MARKETPLACE_ITEM:
        if (state[action.id]) {
            return state;
        }

        return {
            ...state,
            [action.id]: true,
        };

    case ActionTypes.INSTALLING_MARKETPLACE_ITEM_SUCCEEDED:
    case ActionTypes.INSTALLING_MARKETPLACE_ITEM_FAILED: {
        if (!Object.prototype.hasOwnProperty.call(state, action.id)) {
            return state;
        }

        const newState = {...state};
        delete newState[action.id];

        return newState;
    }

    case ActionTypes.MODAL_CLOSE:
        if (action.modalId !== ModalIdentifiers.PLUGIN_MARKETPLACE) {
            return state;
        }

        return {};

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

// errors tracks the error messages for items that failed installation
function errors(state: {[id: string]: string} = {}, action: GenericAction): {[id: string]: string} {
    switch (action.type) {
    case ActionTypes.INSTALLING_MARKETPLACE_ITEM_FAILED:
        return {
            ...state,
            [action.id]: action.error,
        };

    case ActionTypes.INSTALLING_MARKETPLACE_ITEM_SUCCEEDED:
    case ActionTypes.INSTALLING_MARKETPLACE_ITEM: {
        if (!Object.prototype.hasOwnProperty.call(state, action.id)) {
            return state;
        }

        const newState = {...state};
        delete newState[action.id];

        return newState;
    }

    case ActionTypes.MODAL_CLOSE:
        if (action.modalId !== ModalIdentifiers.PLUGIN_MARKETPLACE) {
            return state;
        }

        return {};

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

// filter tracks the current marketplace search query filter
function filter(state = '', action: GenericAction): string {
    switch (action.type) {
    case ActionTypes.FILTER_MARKETPLACE_LISTING:
        return action.filter;

    case ActionTypes.MODAL_CLOSE:
        if (action.modalId !== ModalIdentifiers.PLUGIN_MARKETPLACE) {
            return state;
        }

        return '';

    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

export default combineReducers({
    plugins,
    apps,
    installing,
    errors,
    filter,
});
