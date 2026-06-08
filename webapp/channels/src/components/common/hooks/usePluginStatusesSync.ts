// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef} from 'react';
import {useDispatch} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';

import {getPluginStatuses} from 'mattermost-redux/actions/admin';

import {useWebSocket, useWebSocketClient} from 'utils/use_websocket/hooks';

const DEBOUNCE_DELAY_MS = 500;

/**
 * Refetches the cluster-wide plugin statuses whenever the server signals that they changed.
 *
 * The plugin_statuses_changed websocket event carries no payload; it only signals admin clients
 * to refetch on demand. Subscribing from a component means the refetch only happens while that
 * component is mounted, and the debounce collapses bursts such as a daily restart's
 * prepackaged-plugin reinstall. A refetch is also triggered on websocket reconnect, since any
 * signals fired while disconnected (e.g. during an HA node restart) would otherwise be missed.
 */
export default function usePluginStatusesSync() {
    const dispatch = useDispatch();
    const wsClient = useWebSocketClient();
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const debouncedRefetch = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            dispatch(getPluginStatuses());
        }, DEBOUNCE_DELAY_MS);
    }, [dispatch]);

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
