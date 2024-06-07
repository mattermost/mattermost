// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import {GeneralTypes, UserTypes} from 'mattermost-redux/action_types';

function getInitialState() {
    return {
        connected: false,
        lastConnectAt: 0,
        lastDisconnectAt: 0,
        connectionId: '',
    };
}

export default function reducer(state = getInitialState(), action: AnyAction) {
    if (!state.connected && action.type === GeneralTypes.WEBSOCKET_SUCCESS) {
        return {
            ...state,
            connected: true,
            lastConnectAt: action.timestamp,
        };
    } else if (state.connected && (action.type === GeneralTypes.WEBSOCKET_FAILURE || action.type === GeneralTypes.WEBSOCKET_CLOSED)) {
        return {
            ...state,
            connected: false,
            lastDisconnectAt: action.timestamp,
        };
    }

    if (action.type === UserTypes.LOGOUT_SUCCESS) {
        return getInitialState();
    }

    if (action.type === UserTypes.LOGOUT_SUCCESS) {
        return getInitialState();
    }

    if (action.type === GeneralTypes.SET_CONNECTION_ID) {
        return {
            ...state,
            connectionId: action.payload.connectionId,
        };
    }

    return state;
}
