// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';

import {getAgentsStatus} from 'mattermost-redux/actions/agents';
import {getAgentsStatus as getAgentsStatusSelector} from 'mattermost-redux/selectors/entities/agents';

import {useWebSocket} from 'utils/use_websocket/hooks';

const AI_PLUGIN_ID = 'mattermost-ai';
const DEBOUNCE_DELAY_MS = 100; // Debounce refetches within 100ms

export type AgentsBridgeStatus = {
    available: boolean;
    reason?: string;
};

/**
 * Hook to determine if the bridge is enabled by checking if the plugin is active and compatible.
 * This hook:
 * - Fetches status on mount
 * - Returns availability status and reason
 * - Listens to plugin enabled/disabled websocket events for the mattermost-ai plugin
 * - Refetches status when the mattermost-ai plugin is enabled or disabled
 * - Refetches status when the config changes
 */
export default function useGetAgentsBridgeEnabled(): AgentsBridgeStatus {
    const dispatch = useDispatch();
    const status = useSelector(getAgentsStatusSelector);
    const hasFetchedRef = useRef(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch status on mount
    useEffect(() => {
        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            dispatch(getAgentsStatus());
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
            dispatch(getAgentsStatus());
        }, DEBOUNCE_DELAY_MS);
    }, [dispatch]);

    // Handle websocket events for plugin enabled/disabled and config changes
    const handleWebSocketMessage = useCallback((msg: WebSocketMessage) => {
        // Refetch on plugin enabled/disabled for mattermost-ai, or on any config change
        // Note: When a plugin is enabled/disabled, the backend fires CONFIG_CHANGED first,
        // then PLUGIN_ENABLED/PLUGIN_DISABLED. We debounce to avoid duplicate fetches.
        const isPluginEvent =
            (msg.event === WebSocketEvents.PluginEnabled || msg.event === WebSocketEvents.PluginDisabled) &&
            msg.data?.manifest?.id === AI_PLUGIN_ID;

        const isConfigChange = msg.event === WebSocketEvents.ConfigChanged;

        if (isPluginEvent || isConfigChange) {
            debouncedRefetch();
        }
    }, [debouncedRefetch]);

    useWebSocket({handler: handleWebSocketMessage});

    return status;
}
