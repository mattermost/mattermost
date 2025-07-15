// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RequireOnlyOne} from '@mattermost/types/utilities';

/**
 * SuggestionResult stores a list of suggestions
 * all of the results are rendered with the same component.
 */
export type SuggestionResults<Item> = {
    matchedPretext: string;
    terms: string[];
    items: Array<Item | Loading>;
    components: React.ElementType[];
};

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

export type Loading = {
    type: string;
    loading: boolean;
};

export function normalizeResultsFromProvider<Item>(providerResults: ProviderResults<Item>): SuggestionResults<Item> {
    const components = providerResults.components ?? new Array(providerResults.terms.length).fill(providerResults.component);

    return {
        matchedPretext: providerResults.matchedPretext,
        terms: providerResults.terms,
        items: providerResults.items,
        components,
    };
}

