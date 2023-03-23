// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GeneralTypes, UserTypes} from 'mattermost-redux/action_types';
import {GenericAction} from 'mattermost-redux/types/actions';

function getInitialState() {
    return {
        connected: false,
        lastConnectAt: 0,
        lastDisconnectAt: 0,
        connectionId: '',
    };
}

export default function reducer(state = getInitialState(), action: GenericAction) {
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
