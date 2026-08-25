// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElementType} from 'react';

import type {
    Loading,
    ProviderResults,
    ProviderResultsGroup,
    ProviderResultsUngrouped,
    Suggestion,
    SuggestionResults,
} from '@mattermost/shared/types/global';

export type {
    Loading,
    ProviderResults,
    ProviderResultsGroup,
    Suggestion,
    SuggestionResults,
    SuggestionResultsGroup,
    SuggestionResultsUngrouped,
} from '@mattermost/shared/types/global';

export function isItemLoaded<Item>(item: Item | Loading): item is Item {
    return !item || typeof item !== 'object' || !('loading' in item) || !item.loading;
}

export function emptyResults<Item>(): SuggestionResults<Item> {
    return freezeResults({
        matchedPretext: '',
        suggestions: [],
    });
}

export function hasResults(results: SuggestionResults): boolean {
    return countResults(results) > 0;
}

export function hasLoadedResults(results: SuggestionResults): boolean {
    return flattenSuggestions(results).some((suggestion) => isItemLoaded(suggestion.item));
}

export function countResults(results: SuggestionResults): number {
    return flattenSuggestions(results).length;
}

export function getItemForTerm<Item>(results: SuggestionResults<Item>, term: string): Item | undefined {
    const suggestion = flattenSuggestions(results).find((suggestion) => suggestion.term === term);

    // This isn't technically true, but the way that loading items are handled makes typing difficult. We should
    // find a better way to represent that in the future
    return suggestion?.item as Item | undefined;
}

export function flattenSuggestions<Item>(results: SuggestionResults<Item>): Array<Suggestion<Item>> {
    if ('groups' in results) {
        return results.groups.flatMap((group) => group.suggestions);
    }

    return results.suggestions;
}

export function flattenTerms(results: SuggestionResults): string[] {
    return flattenSuggestions(results).map((suggestion) => suggestion.term);
}

export function flattenItems<Item>(results: SuggestionResults<Item>): Item[] {
    // This isn't technically true, but the way that loading items are handled makes typing difficult. We should
    // find a better way to represent that in the future
    return flattenSuggestions(results).map((suggestion) => suggestion.item) as Item[];
}

export function hasSuggestionWithComponent(results: SuggestionResults, componentType: ElementType) {
    return flattenSuggestions(results).some((suggestion) => suggestion.component === componentType);
}

/**
 * Converts the results emitted by a provider into the results rendered by SuggestionList, pairing each term with
 * its item and the component which renders them.
 *
 * Every array returned by this is freshly allocated, so a provider is free to keep mutating whatever it built its
 * results from without affecting results that have already been rendered.
 */
export function normalizeResultsFromProvider<Item>(providerResults: ProviderResults<Item>): SuggestionResults<Item> {
    if ('groups' in providerResults) {
        return freezeResults({
            matchedPretext: providerResults.matchedPretext,
            groups: providerResults.groups.map((group) => ({
                key: group.key,
                label: group.label,
                suggestions: toSuggestions(group),
            })),
        });
    }

    return freezeResults({
        matchedPretext: providerResults.matchedPretext,
        suggestions: toSuggestions(providerResults),
    });
}

function toSuggestions<Item>(results: ProviderResultsGroup<Item> | ProviderResultsUngrouped<Item>): Array<Suggestion<Item>> {
    // Terms are what identify a suggestion, so an item without one can't be selected or completed and is ignored
    return results.terms.map((term, index) => ({
        term,
        item: results.items[index],
        component: 'components' in results ? results.components[index] : results.component,
    }));
}

/**
 * Returns a copy of the given results containing at most a maximum number of suggestions. If the results are
 * grouped, any group left without suggestions is removed.
 */
export function trimResults<Item>(results: SuggestionResults<Item>, max: number): SuggestionResults<Item> {
    if ('groups' in results) {
        const groups = [];

        let remaining = max;
        for (const group of results.groups) {
            if (remaining <= 0) {
                break;
            }

            const suggestions = group.suggestions.slice(0, remaining);
            if (suggestions.length === 0) {
                continue;
            }

            remaining -= suggestions.length;

            groups.push({...group, suggestions});
        }

        return freezeResults({...results, groups});
    }

    return freezeResults({...results, suggestions: results.suggestions.slice(0, max)});
}

/**
 * Results are handed to React and may be read by any render, including one which a concurrent update interrupted
 * partway through. Freeze them outside of production so that anything holding onto results and mutating them fails
 * at the mutation instead of tearing a later render.
 */
function freezeResults<T extends SuggestionResults<unknown>>(results: T): T {
    // Skip the overhead of freezing in production, as with the Redux store.
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV === 'production') {
        return results;
    }

    if ('groups' in results) {
        for (const group of results.groups) {
            Object.freeze(group.suggestions);
        }
        Object.freeze(results.groups);
    } else {
        Object.freeze(results.suggestions);
    }

    return Object.freeze(results);
}
