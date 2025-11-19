// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';

/**
 * SuggestionResult stores a list of suggestions rendered by the SuggestionBox/SuggestionList.
 */
export type SuggestionResults<Item = unknown> = SuggestionResultsGrouped<Item> | SuggestionResultsUngrouped<Item>;

export type SuggestionResultsGrouped<Item = unknown> = {

    /**
     * The text before the cursor that will be replaced if the corresponding autocomplete term is selected
     */
    matchedPretext: string;

    groups: Array<SuggestionResultsGroup<Item>>;
};

export type SuggestionResultsGroup<Item = unknown> = {

    /**
     * A unique identifier for this type of group
     */
    key: string;

    /**
     * The label for the group displayed to the user
     */
    label: MessageDescriptor;

    /**
     * A list of strings which the previously typed text may be replaced by.
     *
     * The lengths of `terms`, `items`, and `components` MUST be the same because their entries correspond to each other.
     */
    terms: string[];

    /**
     * A list of objects backing the terms which may be used in rendering.
     *
     * The lengths of `terms`, `items`, and `components` MUST be the same because their entries correspond to each other.
     */
    items: Array<Item | Loading>;

    /**
     * A list of react components that can be used to render their corresponding item.
     *
     * The lengths of `terms`, `items`, and `components` MUST be the same because their entries correspond to each other.
     */
    components: React.ElementType[];
};

export type SuggestionResultsUngrouped<Item = unknown> = {

    /**
     * The text before the cursor that will be replaced if the corresponding autocomplete term is selected
     */
    matchedPretext: string;

    /**
     * A list of strings which the previously typed text may be replaced by.
     *
     * The lengths of `terms`, `items`, and `components` MUST be the same because their entries correspond to each other.
     */
    terms: string[];

    /**
     * A list of objects backing the terms which may be used in rendering.
     *
     * The lengths of `terms`, `items`, and `components` MUST be the same because their entries correspond to each other.
     */
    items: Array<Item | Loading>;

    /**
     * A list of react components that can be used to render their corresponding item.
     *
     * The lengths of `terms`, `items`, and `components` MUST be the same because their entries correspond to each other.
     */
    components: React.ElementType[];
};

export type Loading = {
    loading: boolean;
};

/**
 * Returns true if the item is an actual item and not an indicator that more results are being loaded.
 */
export function isItemLoaded<Item>(item: Item | Loading): item is Item {
    return !item || typeof item !== 'object' || !('loading' in item) || !item.loading;
}

export function emptyResults<Item>(): SuggestionResults<Item> {
    return {
        matchedPretext: '',
        terms: [],
        items: [],
        components: [],
    };
}

/**
 * Returns true if there are any items being suggested or if suggestions are being loaded.
 */
export function hasResults(results: SuggestionResults): boolean {
    return countResults(results) > 0;
}

/**
 * Returns true if there are any items being suggested, even if more are being loaded.
 */
export function hasLoadedResults(results: SuggestionResults): boolean {
    if ('groups' in results) {
        return results.groups.some((group) => group.items.some(isItemLoaded));
    }

    return results.items.some(isItemLoaded);
}

/**
 * Returns the number of items being suggested and loading indicators in the results.
 */
export function countResults(results: SuggestionResults): number {
    if ('groups' in results) {
        return results.groups.reduce((count, group) => count + group.items.length, 0);
    }

    return results.items.length;
}

/**
 * Given a term in the suggestions, returns the corresponding item or undefined if it can't be found.
 */
export function getItemForTerm<Item>(results: SuggestionResults<Item>, term: string): Item | undefined {
    if ('groups' in results) {
        for (const group of results.groups) {
            const index = group.terms.indexOf(term);
            if (index !== -1) {
                return group.items[index] as Item;
            }
        }

        return undefined;
    }

    const index = results.terms.indexOf(term);
    return index === -1 ? undefined : results.items[index] as Item;
}

/**
 * Returns a flat array of terms being suggested for cases where that's needed like for keyboard navigation.
 */
export function flattenTerms(results: SuggestionResults | ProviderResults): string[] {
    if ('groups' in results) {
        return results.groups.flatMap((group) => group.terms);
    }

    return results.terms;
}

/**
 * Returns a flat array of items being suggested for cases where we need to iterate over them.
 */
export function flattenItems<Item>(results: SuggestionResults<Item> | ProviderResults<Item>): Item[] {
    if ('groups' in results) {
        return results.groups.flatMap((group) => group.items as Item);
    }

    // This isn't technically true, but the way that loading items are handled makes typing difficult. We should
    // find a better way to represent that in the future
    return results.items as Item[];
}

/**
 * Returns true if any of the items being suggested is rendered with the corresponding component.
 */
export function hasSuggestionWithComponent(results: SuggestionResults, componentType: React.ElementType) {
    if ('groups' in results) {
        return results.groups.some((group) => group.components.includes(componentType));
    }

    return results.components.includes(componentType);
}

/**
 * ProviderResults is similar to {@link SuggestionResults}, but it accepts a single component for convenience in cases where
 * all of the results are rendered with the same component. It's up to the calling code to normalize this object
 */
export type ProviderResults<Item = unknown> = ProviderResultsGrouped<Item> | ProviderResultsUngrouped<Item>;

export type ProviderResultsGrouped<Item = unknown> = {
    matchedPretext: string;
    groups: Array<ProviderResultsGroup<Item>>;
}

export type ProviderResultsGroup<Item = unknown> = {
    key: string;
    label: MessageDescriptor;

    terms: string[];
    items: Array<Item | Loading>;
} & ComponentOrComponents;

export type ProviderResultsUngrouped<Item = unknown> = {
    matchedPretext: string;
    terms: string[];
    items: Array<Item | Loading>;
} & ComponentOrComponents;

type ComponentOrComponents = {
    component: React.ElementType;
} | {
    components: React.ElementType[];
}

/**
 * Converts the results from a Provider which may have one or multiple components specified into one which always
 * contains an array of components.
 */
export function normalizeResultsFromProvider<Item>(providerResults: ProviderResults<Item>): SuggestionResults<Item> {
    if ('components' in providerResults) {
        return providerResults;
    }

    if ('groups' in providerResults) {
        return {
            matchedPretext: providerResults.matchedPretext,
            groups: providerResults.groups.map((group) => {
                if ('components' in group) {
                    return group;
                }

                const {component, ...otherFields} = group;

                return {
                    ...otherFields,
                    components: new Array(group.terms.length).fill(component),
                };
            }),
        };
    }

    const {component, ...otherFields} = providerResults;

    return {
        ...otherFields,
        components: new Array(providerResults.terms.length).fill(component),
    };
}

/**
 * Trims a list of results so that there are at most a maximum number of suggestions in it. If the results are grouped,
 * empty groups are also removed.
 *
 * This function modifies the provided results.
 */
export function trimResults(results: SuggestionResults, max: number) {
    if ('groups' in results) {
        let remaining = max;

        let i = 0;
        while (i < results.groups.length && remaining > 0) {
            const group = results.groups[i];

            group.items = group.items.slice(0, remaining);
            group.terms = group.terms.slice(0, remaining);
            group.components = group.components.slice(0, remaining);

            remaining -= group.items.length;

            i += 1;
        }

        if (i < results.groups.length) {
            results.groups = results.groups.slice(0, i);
        }
    } else {
        results.items = results.items.slice(0, max);
        results.terms = results.terms.slice(0, max);
        results.components = results.components.slice(0, max);
    }

    return results;
}
