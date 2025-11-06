// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';

import {SocketEvents} from 'utils/constants';
import {useWebSocket} from 'utils/use_websocket/hooks';

const AI_PLUGIN_ID = 'mattermost-ai';
const DEBOUNCE_DELAY_MS = 100; // Debounce refetches within 100ms

/**
 * Hook to determine if the bridge is enabled by checking if there are available agents.
 * This hook:
 * - Fetches agents on mount
 * - Returns true if agents are available, false otherwise
 * - Listens to plugin enabled/disabled websocket events for the mattermost-ai plugin
 * - Refetches agents when the mattermost-ai plugin is enabled or disabled
 * - Refetches agents when the config changes to account for new agents being added
 */
export default function useGetAgentsBridgeEnabled(): boolean {
    const dispatch = useDispatch();
    const agents = useSelector(getAgents);
    const hasFetchedRef = useRef(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch agents on mount
    useEffect(() => {
        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            dispatch(getAgentsAction());
        }
    }, [dispatch]);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    // Debounced refetch to avoid duplicate fetches when multiple events fire in quick succession
    const debouncedRefetch = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            dispatch(getAgentsAction());
        }, DEBOUNCE_DELAY_MS);
    }, [dispatch]);

    // Handle websocket events for plugin enabled/disabled and config changes
    const handleWebSocketMessage = useCallback((msg: WebSocketMessage) => {
        // Refetch on plugin enabled/disabled for mattermost-ai, or on any config change
        // Note: When a plugin is enabled/disabled, the backend fires CONFIG_CHANGED first,
        // then PLUGIN_ENABLED/PLUGIN_DISABLED. We debounce to avoid duplicate fetches.
        const isPluginEvent =
            (msg.event === SocketEvents.PLUGIN_ENABLED || msg.event === SocketEvents.PLUGIN_DISABLED) &&
            msg.data?.manifest?.id === AI_PLUGIN_ID;

        const isConfigChange = msg.event === SocketEvents.CONFIG_CHANGED;

        if (isPluginEvent || isConfigChange) {
            debouncedRefetch();
        }
    }, [debouncedRefetch]);

    useWebSocket({handler: handleWebSocketMessage});

    // Return true if agents list is not empty, false otherwise
    return Boolean(agents && agents.length > 0);
}

