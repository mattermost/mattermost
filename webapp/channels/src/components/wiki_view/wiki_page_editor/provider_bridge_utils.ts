// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ProviderResults, ProviderResultsGrouped} from 'components/suggestion/suggestion_results';

/**
 * Provider interface for wrapping Mattermost suggestion providers.
 * Uses `unknown` to match the base Provider class signature.
 */
type SuggestionProvider = {
    handlePretextChanged: (pretext: string, callback: (results: ProviderResults<unknown>) => void) => boolean;
};

/**
 * Creates a stateful wrapper that adds per-instance query sequencing to
 * wrapProviderCallback. Call this once per suggestion provider instance
 * (not per query) to get an `items` function suitable for TipTap suggestions.
 *
 * When the user types rapidly, old in-flight requests resolve with an empty
 * array instead of updating the suggestion list with stale results.
 */
export function createProviderItemsFn<T>(
    provider: SuggestionProvider,
    buildPretext: (query: string) => string,
): ({query}: {query: string}) => Promise<T[]> {
    let currentSeq = 0;

    return ({query}: {query: string}): Promise<T[]> => {
        const mySeq = ++currentSeq;
        return wrapProviderCallback<T>(provider, buildPretext(query)).then((items) => {
            if (mySeq !== currentSeq) {
                return [];
            }
            return items;
        });
    };
}

export function wrapProviderCallback<T>(
    provider: SuggestionProvider,
    pretext: string,
): Promise<T[]> {
    return new Promise((resolve) => {
        let resolved = false;
        let latestItems: T[] = [];
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const resolveWithItems = () => {
            if (!resolved) {
                resolved = true;
                resolve(latestItems);
            }
        };

        const handled = provider.handlePretextChanged(pretext, (results: ProviderResults<unknown>) => {
            if (!results || !('groups' in results) || !results.groups) {
                resolveWithItems();
                return;
            }

            const groupedResults = results as ProviderResultsGrouped<unknown>;
            latestItems = groupedResults.groups.flatMap((group) => {
                return group.items || [];
            }) as T[];

            // Clear any existing debounce timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            // Wait briefly for any additional callbacks (server results typically arrive within 100-200ms)
            // If no more callbacks come, resolve with the latest items
            debounceTimer = setTimeout(resolveWithItems, 150);
        });

        if (!handled) {
            resolveWithItems();
        }
    });
}
