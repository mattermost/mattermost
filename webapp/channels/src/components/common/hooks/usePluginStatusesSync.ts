// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';

import {getPluginStatuses} from 'mattermost-redux/actions/admin';

import {useDebounce} from 'hooks/useDebounce';
import {useWebSocket, useWebSocketClient} from 'utils/use_websocket/hooks';

const DEBOUNCE_DELAY_MS = 500;

/**
 * Refetches the cluster-wide plugin statuses whenever the server signals that they changed.
 */
export default function usePluginStatusesSync() {
    const dispatch = useDispatch();
    const wsClient = useWebSocketClient();

    const debouncedRefetch = useDebounce(() => {
        dispatch(getPluginStatuses());
    }, DEBOUNCE_DELAY_MS);

    const handleWebSocketMessage = useCallback((msg: WebSocketMessage) => {
        if (msg.event === WebSocketEvents.PluginStatusesChanged) {
            debouncedRefetch();
        }
    }, [debouncedRefetch]);

    useWebSocket({handler: handleWebSocketMessage});

    useEffect(() => {
        wsClient.addReconnectListener(debouncedRefetch);
        return () => {
            wsClient.removeReconnectListener(debouncedRefetch);
        };
    }, [wsClient, debouncedRefetch]);
}
