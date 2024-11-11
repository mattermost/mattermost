// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FormatTextOptions, MessageHtmlToComponentOptions} from './markdown';
import type {useWebSocket, useWebSocketClient} from './websocket';

export interface PluginContext {
    formatText(text: string, options?: FormatTextOptions): string;
    messageHtmlToComponent(text: string, options?: MessageHtmlToComponentOptions): JSX.Element;

    useWebSocket: typeof useWebSocket;
    useWebSocketClient: typeof useWebSocketClient;
}

export const fallbackContext: PluginContext = {
    formatText() {
        throw new Error('formatText used outside of plugin context');
    },
    messageHtmlToComponent() {
        throw new Error('messageHtmlToComponent used outside of plugin context');
    },

    useWebSocket() {
        throw new Error('useWebSocket used outside of plugin context');
    },
    useWebSocketClient() {
        throw new Error('useWebSocketClient used outside of plugin context');
    },
};

const pluginContext = React.createContext<PluginContext>(fallbackContext);
pluginContext.displayName = 'PluginContext';

export const Provider = pluginContext.Provider;

export function usePluginContext() {
    return React.useContext(pluginContext);
}
