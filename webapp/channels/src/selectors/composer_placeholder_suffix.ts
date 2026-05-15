// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import type {GlobalState} from 'types/store';

// Keyed by `${pluginId}:${id}` or `${pluginId}:${id}:text` — tracks which registrations have already logged an error.
const loggedSuffixErrors = new Set<string>();

export function clearLoggedSuffixErrors(pluginId?: string): void {
    if (pluginId === undefined) {
        loggedSuffixErrors.clear();
    } else {
        for (const key of loggedSuffixErrors) {
            if (key.startsWith(`${pluginId}:`)) {
                loggedSuffixErrors.delete(key);
            }
        }
    }
}

export function getComposerPlaceholderSuffix(
    state: GlobalState,
    channelId: string,
    intl: IntlShape,
): string {
    if (!channelId) {
        return '';
    }
    const registrations = state.plugins.components.ComposerPlaceholderSuffix;
    if (!registrations?.length) {
        return '';
    }
    const channel = state.entities?.channels?.channels?.[channelId];
    if (!channel) {
        return '';
    }

    let result = '';
    for (const entry of registrations) {
        let matched = false;
        try {
            matched = entry.matcher(channel, state) === true;
        } catch (err) {
            const matcherKey = `${entry.pluginId}:${entry.id}`;
            if (!loggedSuffixErrors.has(matcherKey)) {
                loggedSuffixErrors.add(matcherKey);
                // eslint-disable-next-line no-console
                console.error(
                    `ComposerPlaceholderSuffix: matcher for plugin '${entry.pluginId}' threw — treating as no-match.`,
                    err,
                );
            }
            continue;
        }

        if (!matched) {
            continue;
        }

        if (typeof entry.text === 'string') {
            result += entry.text;
        } else {
            try {
                const textResult = entry.text(channel, state, intl);
                if (typeof textResult === 'string') {
                    result += textResult;
                }
            } catch (err) {
                const textKey = `${entry.pluginId}:${entry.id}:text`;
                if (!loggedSuffixErrors.has(textKey)) {
                    loggedSuffixErrors.add(textKey);
                    // eslint-disable-next-line no-console
                    console.error(
                        `ComposerPlaceholderSuffix: text function for plugin '${entry.pluginId}' threw — skipping suffix.`,
                        err,
                    );
                }
            }
        }
    }

    return result;
}
