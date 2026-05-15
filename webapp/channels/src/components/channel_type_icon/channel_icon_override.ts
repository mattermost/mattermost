// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {Channel} from '@mattermost/types/channels';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {getChannelIconClassName} from 'utils/channel_utils';

import type {GlobalState} from 'types/store';
import type {ChannelIconOverrideRegistration} from 'types/store/plugins';

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

function iterateMatchersForChannel(
    channel: Channel,
    overrides: ChannelIconOverrideRegistration[],
    state: GlobalState,
): IconGlyphTypes | null {
    for (const entry of overrides) {
        try {
            if (entry.matcher(state, channel) === true) {
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

const EMPTY_OVERRIDE_MAP: Readonly<Record<string, IconGlyphTypes>> = Object.freeze({});

const selectAllChannels = (state: GlobalState) => state.entities?.channels?.channels ?? {};
const selectChannelIconOverrides = (state: GlobalState) => state.plugins.components.ChannelIconOverride;
const selectFullState = (state: GlobalState) => state;

/**
 * Returns a map of channelId → icon name for all cached channels that have a plugin override.
 * Computed once per state-ref-changing dispatch for channels in state.entities.channels.channels.
 * For synthetic/search/admin channel objects not in the store, use the wrapper functions below.
 */
export const getAllChannelIconOverrideNames = createSelector(
    'getAllChannelIconOverrideNames',
    selectAllChannels,
    selectChannelIconOverrides,
    selectFullState,
    (channels, overrides, state): Readonly<Record<string, IconGlyphTypes>> => {
        if (!overrides?.length) {
            return EMPTY_OVERRIDE_MAP;
        }
        const result: Record<string, IconGlyphTypes> = {};
        for (const channelId of Object.keys(channels)) {
            const name = iterateMatchersForChannel(channels[channelId], overrides, state);
            if (name !== null) {
                result[channelId] = name;
            }
        }
        return result;
    },
);

/**
 * Returns the IconGlyphTypes name of the first matching plugin override, or null.
 *
 * If the passed channel is the same reference as the cached store entry, looks up the
 * memoized override map (computed once per dispatch). Otherwise falls back to per-channel
 * matcher iteration — this preserves correct behavior for synthetic/search/admin channel
 * objects that aren't the same ref as the store entry.
 */
export function getChannelIconOverrideForChannel(
    state: GlobalState,
    channel?: Channel | null,
): IconGlyphTypes | null {
    if (!channel) {
        return null;
    }
    const overrides = state.plugins.components.ChannelIconOverride;
    if (!overrides?.length) {
        return null;
    }
    const channelCache = state.entities?.channels?.channels;
    if (channelCache && channelCache[channel.id] === channel) {
        return getAllChannelIconOverrideNames(state)[channel.id] ?? null;
    }
    return iterateMatchersForChannel(channel, overrides, state);
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
    channel?: Channel | null,
): string {
    const overrideName = getChannelIconOverrideForChannel(state, channel ?? undefined);
    if (overrideName) {
        return `icon-${overrideName}`;
    }
    return getChannelIconClassName(channel ?? undefined);
}
