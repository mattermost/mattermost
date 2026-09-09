// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElementType} from 'react';
import type {MessageDescriptor} from 'react-intl';

// Data shapes produced by suggestion providers and consumed by SuggestionList.

export type SuggestionResults<Item = unknown> = SuggestionResultsGrouped<Item> | SuggestionResultsUngrouped<Item>;

type SuggestionResultsGrouped<Item = unknown> = {
    matchedPretext: string;
    groups: Array<SuggestionResultsGroup<Item>>;
};

type SuggestionResultsGroup<Item = unknown> = {
    key: string;
    label?: MessageDescriptor;
    terms: string[];
    items: Array<Item | Loading>;
    components: ElementType[];
};

export type SuggestionResultsUngrouped<Item = unknown> = {
    matchedPretext: string;
    terms: string[];
    items: Array<Item | Loading>;
    components: ElementType[];
};

export type Loading = {
    loading: boolean;
};

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

type ProviderResultsUngrouped<Item = unknown> = {
    matchedPretext: string;
    terms: string[];
    items: Array<Item | Loading>;
} & ComponentOrComponents;

type ComponentOrComponents = {
    component: ElementType;
} | {
    components: ElementType[];
};
