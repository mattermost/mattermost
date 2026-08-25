// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElementType} from 'react';
import type {MessageDescriptor} from 'react-intl';

// Data shapes produced by suggestion providers and consumed by SuggestionList.

/**
 * A single suggestion as rendered by SuggestionList. The term, the item and the component that
 * renders them are stored together so that they can't be mistakenly paired with each other.
 */
export type Suggestion<Item = unknown> = {
    term: string;
    item: Item | Loading;
    component: ElementType;
};

export type SuggestionResults<Item = unknown> = SuggestionResultsGrouped<Item> | SuggestionResultsUngrouped<Item>;

type SuggestionResultsGrouped<Item = unknown> = {
    matchedPretext: string;
    groups: Array<SuggestionResultsGroup<Item>>;
};

export type SuggestionResultsGroup<Item = unknown> = {
    key: string;
    label?: MessageDescriptor;
    suggestions: Array<Suggestion<Item>>;
};

export type SuggestionResultsUngrouped<Item = unknown> = {
    matchedPretext: string;
    suggestions: Array<Suggestion<Item>>;
};

export type Loading = {
    loading: boolean;
};

// Results as emitted by a provider, which may pair a single component with every item to save
// repeating it. This shape is part of the plugin API, so it can only be changed in a backwards
// compatible way. normalizeResultsFromProvider converts it into SuggestionResults for rendering.
export type ProviderResults<Item = unknown> = ProviderResultsGrouped<Item> | ProviderResultsUngrouped<Item>;

type ProviderResultsGrouped<Item = unknown> = {
    matchedPretext: string;
    groups: Array<ProviderResultsGroup<Item>>;
};

export type ProviderResultsGroup<Item = unknown> = {
    key: string;
    label?: MessageDescriptor;
    terms: string[];
    items: Array<Item | Loading>;
} & ComponentOrComponents;

export type ProviderResultsUngrouped<Item = unknown> = {
    matchedPretext: string;
    terms: string[];
    items: Array<Item | Loading>;
} & ComponentOrComponents;

type ComponentOrComponents = {
    component: ElementType;
} | {
    components: ElementType[];
};
