// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {Channel} from '@mattermost/types/channels';

import {getChannelIconClassName} from 'utils/channel_utils';

import type {GlobalState} from 'types/store';

// Tracks plugin ids that have already logged a matcher error to avoid spamming the console.
const loggedMatcherErrors = new Set<string>();

/**
 * Clears the per-pluginId log-once tracker for matcher errors.
 * No-arg form clears all entries; with-arg form clears one plugin's entry.
 * Called on each new registration so that re-registering a plugin starts fresh.
 */
export function clearLoggedMatcherErrors(pluginId?: string): void {
    if (pluginId === undefined) {
        loggedMatcherErrors.clear();
    } else {
        loggedMatcherErrors.delete(pluginId);
    }
}

/**
 * Returns the IconGlyphTypes name of the first matching plugin override, or null.
 *
 * If `channel` is present, iterates `state.plugins.components.ChannelIconOverride` in array order
 * (sorted alphabetically by pluginId via the reducer). The first matcher returning true wins.
 * Matcher throws are caught, logged once per pluginId, and treated as no-match.
 *
 * Note: Do not use createSelector here — this is a per-row call over a short override list.
 */
export function getChannelIconOverrideForChannel(
    state: GlobalState,
    channel?: Channel,
): IconGlyphTypes | null {
    if (!channel) {
        return null;
    }
    const overrides = state.plugins.components.ChannelIconOverride ?? [];
    for (const entry of overrides) {
        try {
            const matched = entry.matcher(state, channel);
            if (matched === true) {
                return entry.iconName;
            }
        } catch (err) {
            if (!loggedMatcherErrors.has(entry.pluginId)) {
                loggedMatcherErrors.add(entry.pluginId);
                // eslint-disable-next-line no-console
                console.error(
                    `ChannelIconOverride: matcher for plugin '${entry.pluginId}' threw — treating as no-match.`,
                    err,
                );
            }
        }
    }
    return null;
}

/**
 * Returns the icon CSS class name for a channel, consulting plugin overrides first.
 *
 * Delegates matcher iteration to `getChannelIconOverrideForChannel`. The icon name is already
 * validated against the Compass glyph map at registration time (`registerChannelIconOverride`),
 * so an override that reaches the store is always a known glyph — no render-time validation
 * needed. Falls back to `getChannelIconClassName` when no override matches.
 */
export function getChannelIconClassNameForChannel(
    state: GlobalState,
    channel?: Channel,
): string {
    const overrideName = getChannelIconOverrideForChannel(state, channel);
    if (overrideName) {
        return `icon-${overrideName}`;
    }
    return getChannelIconClassName(channel);
}
