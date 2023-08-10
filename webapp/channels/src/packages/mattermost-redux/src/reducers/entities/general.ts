// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {GeneralTypes, UserTypes} from 'mattermost-redux/action_types';

import type {ClientLicense, ClientConfig} from '@mattermost/types/config';
import type {GenericAction} from 'mattermost-redux/types/actions';

function config(state: Partial<ClientConfig> = {}, action: GenericAction) {
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

function dataRetentionPolicy(state: any = {}, action: GenericAction) {
    switch (action.type) {
    case GeneralTypes.RECEIVED_DATA_RETENTION_POLICY:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function license(state: ClientLicense = {}, action: GenericAction) {
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

function serverVersion(state = '', action: GenericAction) {
    switch (action.type) {
    case GeneralTypes.RECEIVED_SERVER_VERSION:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

function warnMetricsStatus(state: any = {}, action: GenericAction) {
    switch (action.type) {
    case GeneralTypes.WARN_METRICS_STATUS_RECEIVED:
        return action.data;
    case GeneralTypes.WARN_METRIC_STATUS_RECEIVED: {
        const nextState = {...state};
        nextState[action.data.id] = action.data;
        return nextState;
    }
    case GeneralTypes.WARN_METRIC_STATUS_REMOVED: {
        const nextState = {...state};
        const newParams = Object.assign({}, nextState[action.data.id]);
        newParams.acked = true;
        nextState[action.data.id] = newParams;
        return nextState;
    }
    default:
        return state;
    }
}

function firstAdminVisitMarketplaceStatus(state = false, action: GenericAction) {
    switch (action.type) {
    case GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED:
        return action.data;

    default:
        return state;
    }
}

function firstAdminCompleteSetup(state = false, action: GenericAction) {
    switch (action.type) {
    case GeneralTypes.FIRST_ADMIN_COMPLETE_SETUP_RECEIVED:
        return action.data;

    default:
        return state;
    }
}

export default combineReducers({
    config,
    dataRetentionPolicy,
    license,
    serverVersion,
    warnMetricsStatus,
    firstAdminVisitMarketplaceStatus,
    firstAdminCompleteSetup,
});
