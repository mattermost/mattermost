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
 * Wraps a Mattermost suggestion provider's callback-based handlePretextChanged
 * into a Promise-based async function for use with TipTap suggestions.
 *
 * The provider calls its callback multiple times:
 * 1. First with immediate local/cached results
 * 2. Later with server results after async fetch completes
 *
 * We use a debounce approach to wait for all results before resolving.
 *
 * @param provider - Provider with handlePretextChanged method
 * @param pretext - The pretext string to pass to the provider (e.g., "@query", ":query")
 * @returns Promise resolving to array of items
 */
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
