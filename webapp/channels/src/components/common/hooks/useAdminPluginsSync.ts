// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';

import {getPlugins} from 'mattermost-redux/actions/admin';

import {useDebounce} from 'hooks/useDebounce';
import {useWebSocket, useWebSocketClient} from 'utils/use_websocket/hooks';

import type {GlobalState} from 'types/store';

const DEBOUNCE_DELAY_MS = 500;

/**
 * Refetches the installed plugin manifests whenever the server signals that plugins changed,
 * so plugins installed or removed outside this tab show up in the System Console.
 */
export default function useAdminPluginsSync() {
    const dispatch = useDispatch();
    const wsClient = useWebSocketClient();
    const pluginsEnabled = useSelector((state: GlobalState) => Boolean(state.entities.admin.config.PluginSettings?.Enable));

    const debouncedRefetch = useDebounce(() => {
        if (pluginsEnabled) {
            dispatch(getPlugins());
        }
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
