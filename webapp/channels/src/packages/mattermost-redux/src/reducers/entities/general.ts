// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {ClientLicense, ClientConfig} from '@mattermost/types/config';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {GeneralTypes, UserTypes} from 'mattermost-redux/action_types';

function config(state: Partial<ClientConfig> = {}, action: MMReduxAction) {
    switch (action.type) {
    case GeneralTypes.CLIENT_CONFIG_RECEIVED:
        return Object.assign({}, state, action.data);
    case UserTypes.LOGIN: // Used by the mobile app
    case GeneralTypes.SET_CONFIG_AND_LICENSE:
        return Object.assign({}, state, action.data.config);
    case GeneralTypes.CLIENT_CONFIG_RESET:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function license(state: ClientLicense = {}, action: MMReduxAction) {
    switch (action.type) {
    case GeneralTypes.CLIENT_LICENSE_RECEIVED:
        return action.data;
    case GeneralTypes.SET_CONFIG_AND_LICENSE:
        return Object.assign({}, state, action.data.license);
    case GeneralTypes.CLIENT_LICENSE_RESET:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function serverVersion(state = '', action: MMReduxAction) {
    switch (action.type) {
    case GeneralTypes.RECEIVED_SERVER_VERSION:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

function firstAdminVisitMarketplaceStatus(state = false, action: MMReduxAction) {
    switch (action.type) {
    case GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED:
        return action.data;

    default:
        return state;
    }
}

function firstAdminCompleteSetup(state = false, action: MMReduxAction) {
    switch (action.type) {
    case GeneralTypes.FIRST_ADMIN_COMPLETE_SETUP_RECEIVED:
        return action.data;

    default:
        return state;
    }
}

export default combineReducers({
    config,
    license,
    serverVersion,
    firstAdminVisitMarketplaceStatus,
    firstAdminCompleteSetup,
});
