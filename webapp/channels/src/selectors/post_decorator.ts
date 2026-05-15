// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import type {GlobalState} from 'types/store';
import type {PostDecoratorRegistration, PostDecoratorSlot} from 'types/store/plugins';

// Keyed by `${pluginId}:${slot}` — tracks which (plugin, slot) pairs have already logged an error.
const loggedPostDecoratorErrors = new Set<string>();

/**
 * Clears the per-(pluginId, slot) log-once tracker for matcher errors.
 * No-arg form clears all entries; with-arg form clears all entries for one plugin.
 */
export function clearLoggedPostDecoratorErrors(pluginId?: string): void {
    if (pluginId === undefined) {
        loggedPostDecoratorErrors.clear();
    } else {
        // Delete all keys that start with `${pluginId}:`
        for (const key of loggedPostDecoratorErrors) {
            if (key.startsWith(`${pluginId}:`)) {
                loggedPostDecoratorErrors.delete(key);
            }
        }
    }
}

const EMPTY_ARRAY: PostDecoratorRegistration[] = Object.freeze([] as PostDecoratorRegistration[]) as unknown as PostDecoratorRegistration[];

function runMatchers(
    post: Post,
    decorators: PostDecoratorRegistration[],
    slot: PostDecoratorSlot,
    state: GlobalState,
): PostDecoratorRegistration[] {
    const matches: PostDecoratorRegistration[] = [];
    for (const entry of decorators) {
        if (entry.slot !== slot) {
            continue;
        }
        try {
            if (entry.matcher(post, state) === true) {
                matches.push(entry);
            }
        } catch (err) {
            const key = `${entry.pluginId}:${slot}`;
            if (!loggedPostDecoratorErrors.has(key)) {
                loggedPostDecoratorErrors.add(key);
                // eslint-disable-next-line no-console
                console.error(
                    `PostDecorator: matcher for plugin '${entry.pluginId}' at slot '${slot}' threw — treating as no-match.`,
                    err,
                );
            }
        }
    }
    return matches;
}

export function getPostDecoratorsForSlot(
    state: GlobalState,
    post: Post,
    slot: PostDecoratorSlot,
): PostDecoratorRegistration[] {
    if (!post) {
        return EMPTY_ARRAY;
    }
    const decorators = state.plugins.components.PostDecorator;
    if (!decorators?.length) {
        return EMPTY_ARRAY;
    }
    const matches = runMatchers(post, decorators, slot, state);
    return matches.length === 0 ? EMPTY_ARRAY : matches;
}
