// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ChannelDecoratorRegistration, ChannelDecoratorSlot} from 'types/store/plugins';

// Keyed by `${pluginId}:${slot}` — tracks which (plugin, slot) pairs have already logged an error.
const loggedDecoratorErrors = new Set<string>();

/**
 * Clears the per-(pluginId, slot) log-once tracker for matcher errors.
 * No-arg form clears all entries; with-arg form clears all entries for one plugin.
 */
export function clearLoggedDecoratorErrors(pluginId?: string): void {
    if (pluginId === undefined) {
        loggedDecoratorErrors.clear();
    } else {
        // Delete all keys that start with `${pluginId}:`
        for (const key of loggedDecoratorErrors) {
            if (key.startsWith(`${pluginId}:`)) {
                loggedDecoratorErrors.delete(key);
            }
        }
    }
}

const EMPTY_ARRAY: ChannelDecoratorRegistration[] = Object.freeze([] as ChannelDecoratorRegistration[]) as unknown as ChannelDecoratorRegistration[];

function runMatchers(
    channel: Channel,
    decorators: ChannelDecoratorRegistration[],
    slot: ChannelDecoratorSlot,
    state: GlobalState,
    firstOnly: boolean,
): ChannelDecoratorRegistration[] {
    const matches: ChannelDecoratorRegistration[] = [];
    for (const entry of decorators) {
        if (entry.slot !== slot) {
            continue;
        }
        try {
            if (entry.matcher(channel, state) === true) {
                matches.push(entry);
                if (firstOnly) {
                    return matches;
                }
            }
        } catch (err) {
            const key = `${entry.pluginId}:${slot}`;
            if (!loggedDecoratorErrors.has(key)) {
                loggedDecoratorErrors.add(key);
                // eslint-disable-next-line no-console
                console.error(
                    `ChannelDecorator: matcher for plugin '${entry.pluginId}' at slot '${slot}' threw — treating as no-match.`,
                    err,
                );
            }
        }
    }
    return matches;
}

/**
 * Returns matching ChannelDecoratorRegistration[] for a specific channel and slot.
 *
 * For the 'intro' slot: returns an array of length 0 or 1 (first-match-wins).
 * For all other slots: returns all matching registrations.
 *
 * Render sites use `matches[0] ?? null` for intro, and `matches.map(...)` for others.
 */
export function getChannelDecoratorsForSlot(
    state: GlobalState,
    channelId: string,
    slot: ChannelDecoratorSlot,
): ChannelDecoratorRegistration[] {
    if (!channelId) {
        return EMPTY_ARRAY;
    }
    const decorators = state.plugins.components.ChannelDecorator;
    if (!decorators?.length) {
        return EMPTY_ARRAY;
    }
    const channel = state.entities?.channels?.channels?.[channelId];
    if (!channel) {
        return EMPTY_ARRAY;
    }
    const matches = runMatchers(channel, decorators, slot, state, slot === 'intro');
    return matches.length === 0 ? EMPTY_ARRAY : matches;
}
