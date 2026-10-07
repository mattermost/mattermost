// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevel} from '@mattermost/types/client4';

import {Client4} from 'mattermost-redux/client';

type RootAPI = 'createRoot' | 'hydrateRoot';
type Plugin = {id: string; version: string};

const attemptedEvents = new Set<string>();

function findPlugin(stack: string | undefined): Plugin {
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[id^="plugin_"]');
    for (const frame of stack?.split('\n') ?? []) {
        const url = frame.match(/(?:^|[\s(@])([a-z][a-z\d+.-]*:\/\/\S+?):\d+(?::\d+)?\)?\s*$/i)?.[1];
        for (const script of scripts) {
            if (url === script.src) {
                return {id: script.id.slice('plugin_'.length) || 'unknown', version: script.dataset.pluginVersion || 'unknown'};
            }
        }
    }

    return {id: 'unknown', version: 'unknown'};
}

function logRootEvent(kind: 'used' | 'failed', api: RootAPI, plugin: Plugin, error?: unknown) {
    try {
        const key = JSON.stringify([kind, plugin.id, plugin.version, api]);
        if (attemptedEvents.has(key)) {
            return;
        }
        attemptedEvents.add(key);

        if (kind === 'used' && Math.random() >= 0.05) {
            return;
        }

        let message = `plugin_react_dom_shim_${kind} api=${api} plugin_id=${plugin.id} plugin_version=${plugin.version}`;
        if (kind === 'failed') {
            let summary = error;
            if (error && typeof error === 'object' && 'message' in error) {
                summary = error.message;
            }
            message += ` error=${typeof summary === 'string' ? summary : 'unknown'}`;
        }
        message = message.replace(/[^\x20-\x7E]/g, ' ').slice(0, 399);

        Client4.logClientError(message, kind === 'used' ? LogLevel.Debug : LogLevel.Error).catch(() => {});
    } catch {
        // Diagnostics must not interfere with React, even when logging fails synchronously.
    }
}

export function wrapReactDOMRoot<Args extends unknown[], Result>(api: RootAPI, original: (...args: Args) => Result) {
    return function rootWithLogging(this: unknown, ...args: Args): Result {
        if (!Client4.enableLogging) {
            return original.apply(this, args);
        }

        let plugin = {id: 'unknown', version: 'unknown'};
        try {
            plugin = findPlugin(new Error().stack);
        } catch {
            // Attribution is best effort; a missing stack must not block root creation.
        }
        logRootEvent('used', api, plugin);

        try {
            return original.apply(this, args);
        } catch (error) {
            logRootEvent('failed', api, plugin, error);
            throw error;
        }
    };
}
