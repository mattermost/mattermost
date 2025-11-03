// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';

import {getAIAgents as getAIAgentsAction} from 'mattermost-redux/actions/ai';
import {getAIAgents} from 'mattermost-redux/selectors/entities/ai';

import {SocketEvents} from 'utils/constants';
import {useWebSocket} from 'utils/use_websocket/hooks';

const AI_PLUGIN_ID = 'mattermost-ai';

/**
 * Hook to determine if the AI bridge is enabled by checking if there are available AI agents.
 * This hook:
 * - Fetches AI agents on mount
 * - Returns true if agents are available, false otherwise
 * - Listens to plugin enabled/disabled websocket events for the mattermost-ai plugin
 * - Refetches agents when the mattermost-ai plugin is enabled or disabled
 * - Refetches agents when the config changes to account for new agents being added
 */
export default function useGetAgentsBridgeEnabled(): boolean {
    const dispatch = useDispatch();
    const agents = useSelector(getAIAgents);
    const [hasFetched, setHasFetched] = useState(false);

    // Fetch AI agents on mount
    useEffect(() => {
        if (!hasFetched) {
            dispatch(getAIAgentsAction());
            setHasFetched(true);
        }
    }, [dispatch, hasFetched]);

    // Handle websocket events for plugin enabled/disabled and config changes
    const handleWebSocketMessage = useCallback((msg: WebSocketMessage) => {
        // Refetch on plugin enabled/disabled for mattermost-ai
        if (msg.event === SocketEvents.PLUGIN_ENABLED || msg.event === SocketEvents.PLUGIN_DISABLED) {
            const manifest = msg.data?.manifest;
            if (manifest?.id === AI_PLUGIN_ID) {
                dispatch(getAIAgentsAction());
            }
        }

        // Refetch on config changes to account for new agents being added
        if (msg.event === SocketEvents.CONFIG_CHANGED) {
            dispatch(getAIAgentsAction());
        }
    }, [dispatch]);

    useWebSocket({handler: handleWebSocketMessage});

    // Return true if agents list is not empty, false otherwise
    return Boolean(agents && agents.length > 0);
}

