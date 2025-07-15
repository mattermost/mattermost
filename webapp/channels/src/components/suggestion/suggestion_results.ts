// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RequireOnlyOne} from '@mattermost/types/utilities';

/**
 * SuggestionResult stores a list of suggestions
 * all of the results are rendered with the same component.
 */
export type SuggestionResults<Item> = {

    /**
     * The text before the cursor that will be replaced if the corresponding autocomplete term is selected
     */
    matchedPretext: string;

    /**
     * A list of strings which the previously typed text may be replaced by
     */
    terms: string[];

    /**
     * A list of objects backing the terms which may be used in rendering
     */
    items: Array<Item | Loading>;

    /**
     * A list of react components that can be used to render their corresponding item
     */
    components: React.ElementType[];
};

export type Loading = {
    type: string;
    loading: boolean;
};

export function emptyResults<Item>(): SuggestionResults<Item> {
    return {
        matchedPretext: '',
        terms: [],
        items: [],
        components: [],
    };
}

export function hasResults<Item>(results: SuggestionResults<Item>): boolean {
    return countResults(results) > 0;
}

export function hasLoadedResults<Item>(results: SuggestionResults<Item>): boolean {
    return results.items.some((item) => !item || typeof item !== 'object' || !('loading' in item) || !item.loading);
}

export function countResults<Item>(results: SuggestionResults<Item>): number {
    return results.items.length;
}

export function getItemForTerm<Item>(results: SuggestionResults<Item>, term: string): Item | undefined {
    const index = results.terms.indexOf(term);
    return index === -1 ? undefined : results.items[index] as Item;
}

export function flattenTerms<Item>(results: SuggestionResults<Item>): string[] {
    return results.terms;
}

/**
 * ProviderResults is similar to {@link SuggestionResults}, but it accepts a single component for convenience in cases where
 * all of the results are rendered with the same component. It's up to the calling code to normalize this object
 */
export type ProviderResults<Item> = {
    matchedPretext: string;
    terms: string[];
    items: Array<Item | Loading>;
} & RequireOnlyOne<{
    component: React.ElementType;
    components: React.ElementType[];
}>;

export function normalizeResultsFromProvider<Item>(providerResults: ProviderResults<Item>): SuggestionResults<Item> {
    const components = providerResults.components ?? new Array(providerResults.terms.length).fill(providerResults.component);

    return {
        matchedPretext: providerResults.matchedPretext,
        terms: providerResults.terms,
        items: providerResults.items,
        components,
    };
}

