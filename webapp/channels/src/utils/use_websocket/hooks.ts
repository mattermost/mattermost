// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useContext, useEffect} from 'react';

import {WebSocketClient, WebSocketMessage} from '@mattermost/client';

import {WebSocketContext} from './context';

export type UseWebSocketOptions = {
    handler: (msg: WebSocketMessage) => void;
}

export function useWebSocket({handler}: UseWebSocketOptions) {
    const wsClient = useWebSocketClient();

    useEffect(() => {
        wsClient.addMessageListener(handler);

        return () => {
            wsClient.removeMessageListener(handler);
        };
    }, [wsClient, handler]);
}

export function useWebSocketClient(): WebSocketClient {
    return useContext(WebSocketContext);
}
