// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {Channel} from '@mattermost/types/channels';

import {getChannelIconClassName} from 'utils/channel_utils';
import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';

const matcherErrorLog = createPluginErrorLog('ChannelIconOverride');

/**
 * Clears the per-pluginId log-once tracker for matcher errors.
 * No-arg form clears all entries; with-arg form clears one plugin's entry.
 * Called on each new registration so that re-registering a plugin starts fresh.
 */
export const clearLoggedMatcherErrors = matcherErrorLog.clear;

/**
 * Returns the IconGlyphTypes name of the first matching plugin override, or null.
 *
 * Iterates the registered matchers on every call. The framework does not memoize across
 * dispatches because the matcher contract takes full Redux state, so we cannot infer
 * which slices it reads. If a plugin's matcher is expensive, the plugin should memoize
 * inside its own predicate using `createSelector` keyed on the slices it consults.
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
            if (entry.matcher(state, channel) === true) {
                return entry.iconName;
            }
        } catch (err) {
            matcherErrorLog.logOnce(entry.pluginId, err);
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
