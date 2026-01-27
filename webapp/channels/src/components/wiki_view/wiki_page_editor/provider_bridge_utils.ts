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

        const handled = provider.handlePretextChanged(pretext, (results: ProviderResults<unknown>) => {
            if (!results || !('groups' in results) || !results.groups) {
                if (!resolved) {
                    resolved = true;
                    resolve([]);
                }
                return;
            }

            const groupedResults = results as ProviderResultsGrouped<unknown>;
            const allItems = groupedResults.groups.flatMap((group) => {
                return group.items || [];
            }) as T[];

            if (!resolved) {
                resolved = true;
                resolve(allItems);
            }
        });

        if (!handled && !resolved) {
            resolved = true;
            resolve([]);
        }
    });
}
