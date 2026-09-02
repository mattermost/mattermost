// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';

// A throwing transform leaves the placeholder unmodified; the first throw per plugin is logged so a
// broken plugin is diagnosable without spamming the console on every render.
const transformErrorLog = createPluginErrorLog('ComposerPlaceholder', {
    subject: 'transform',
    outcome: 'using the unmodified placeholder',
});

export const clearComposerPlaceholderErrors = transformErrorLog.clear;

// Threads the base placeholder through every plugin-registered transform, letting a plugin append
// to or entirely replace the composer placeholder. Each transform receives the running result, so
// transforms chain: the order is pluginId-alphabetical (the reducer sorts registrations that way),
// and within one plugin registration order is preserved. Returns the base placeholder unchanged
// when there is no channel or no transform acts on it.
export function getComposerPlaceholder(
    state: GlobalState,
    channelId: string | null | undefined,
    basePlaceholder: string,
    intl: IntlShape,
): string {
    const registrations = state.plugins.components.ComposerPlaceholder;
    if (!channelId || !registrations?.length) {
        return basePlaceholder;
    }
    const channel = state.entities?.channels?.channels?.[channelId];
    if (!channel) {
        return basePlaceholder;
    }

    let result = basePlaceholder;
    for (const entry of registrations) {
        try {
            const next = entry.transform(result, channel, state, intl);

            // A non-string return (only reachable from a JS plugin violating the typed contract) is
            // ignored so the placeholder never renders "undefined".
            if (typeof next === 'string') {
                result = next;
            }
        } catch (err) {
            transformErrorLog.logOnce(entry.pluginId, err);
        }
    }

    return result;
}
