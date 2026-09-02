// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';

import {getConfig} from 'mattermost-redux/actions/admin';

import {useWebSocket, useWebSocketClient} from 'utils/use_websocket/hooks';

/**
 * Subscribes to config_changed WebSocket events and reconnects, re-fetching
 * the full admin config each time so the in-memory state stays current.
 */
export default function useAdminConfigSync() {
    const dispatch = useDispatch();
    const wsClient = useWebSocketClient();

    const refetch = useCallback(() => {
        dispatch(getConfig());
    }, [dispatch]);

    const handleWebSocketMessage = useCallback((msg: WebSocketMessage) => {
        if (msg.event === WebSocketEvents.ConfigChanged) {
            refetch();
        }
    }, [refetch]);

    useWebSocket({handler: handleWebSocketMessage});

    useEffect(() => {
        wsClient.addReconnectListener(refetch);
        return () => {
            wsClient.removeReconnectListener(refetch);
        };
    }, [wsClient, refetch]);
}
