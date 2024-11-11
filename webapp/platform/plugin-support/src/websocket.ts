// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebSocketClient, WebSocketMessage} from '@mattermost/client';

import {fallbackContext, usePluginContext} from './context';

export type UseWebSocketOptions = {
    handler: (msg: WebSocketMessage) => void;
}

export function useWebSocket(options: UseWebSocketOptions): void {
    const context = usePluginContext();

    if (context === fallbackContext && window?.ProductApi?.useWebSocket) {
        return window.ProductApi.useWebSocket(options);
    }

    return context.useWebSocket(options);
}

export function useWebSocketClient(): WebSocketClient {
    const context = usePluginContext();

    if (context === fallbackContext && window?.ProductApi?.useWebSocketClient) {
        return window.ProductApi.useWebSocketClient();
    }

    return context.useWebSocketClient();
}
