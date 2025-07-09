// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getSearchPluginSuggestions} from 'selectors/plugins';

import {resultHasItems, type ProviderResult} from 'components/suggestion/provider';
import {SuggestionListGroup, SuggestionListList} from 'components/suggestion/suggestion_list';

import ErrorBoundary from 'plugins/pluggable/error_boundary';

const SuggestionsBody = styled.div`
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding-bottom: 16px;

    .suggestion-list__divider {
        margin-top: 16px;
        padding: 8px 24px;
    }

    ul[role="group"] {
        // Undo padding and margins added by Bootstrap and our design system
        padding: 0;
        margin: 0;
    }
`;

type Props = {
    id: string;
    searchType: string;
    searchTeam: string;
    searchTerms: string;
    selectedTerm: string;
    setSelectedTerm: (newSelectedTerm: string) => void;
    providerResults: ProviderResult<unknown> | null;
    onSearch: (searchType: string, searchTeam: string, searchTerms: string) => void;
    onSuggestionSelected: (value: string, matchedPretext: string) => void;
}

const SearchSuggestions = ({
    id,
    searchType,
    searchTeam,
    searchTerms,
    providerResults,
    selectedTerm,
    setSelectedTerm,
    onSearch,
    onSuggestionSelected,
}: Props) => {
    const runSearch = useCallback((searchTerms: string) => {
        onSearch(searchType, searchTeam, searchTerms);
    }, [onSearch, searchTeam, searchType]);

    const searchPluginSuggestions = useSelector(getSearchPluginSuggestions);

    // const generateLabel = (item: any) => {
    //     let label = '';
    //     if (item.username) {
    //         label = item.username;
    //         if ((item.first_name || item.last_name) && item.nickname) {
    //             label += ` ${item.first_name} ${item.last_name} ${item.nickname}`;
    //         } else if (item.nickname) {
    //             label += ` ${item.nickname}`;
    //         } else if (item.first_name || item.last_name) {
    //             label += ` ${item.first_name} ${item.last_name}`;
    //         }
    //     } else if (item.type === 'D' || item.type === 'G') {
    //         label = item.display_name;
    //     } else if (item.type === 'P' || item.type === 'O') {
    //         label = item.name;
    //     } else if (item.emoji) {
    //         label = item.name;
    //     }

    //     if (label) {
    //         label = label.toLowerCase();
    //     }
    //     return label;
    // };

    if (searchType === '' || searchType === 'messages' || searchType === 'files') {
        if (!providerResults || !resultHasItems(providerResults)) {
            return null;
        }

        const contents = [];

        for (const group of providerResults.groups) {
            if ('items' in group) {
                const items = [];

                for (let i = 0; i < group.items.length; i++) {
                    const Component = providerResults.component!; // TODO?

                    const item = group.items[i];
                    const term = group.terms[i];
                    const isSelection = term === selectedTerm;

                    items.push(
                        <Component
                            key={term}

                            // ref={(ref: any) => this.itemRefs.set(term, ref)}
                            id={`searchBoxSuggestions_item_${term}`}
                            item={item}
                            term={term}

                            matchedPretext={providerResults.matchedPretext}
                            isSelection={isSelection}
                            onClick={onSuggestionSelected}
                            onMouseMove={() => {
                                setSelectedTerm(term);
                            }}
                        />,
                    );
                }

                if (items.length > 0) {
                    contents.push(
                        <SuggestionListGroup
                            key={group.key}
                            groupKey={group.key}
                            labelMessage={group.label}
                            renderDivider={!group.hideLabel}
                        >
                            {items}
                        </SuggestionListGroup>,
                    );
                }
            }
        }

        return (
            <SuggestionsBody>
                {/* {providerResults.component && providerResults.items[selectedOption] && (
                    <div
                        aria-live='polite'
                        role='alert'
                        className='sr-only'
                        key={providerResults.terms[selectedOption]}
                    >
                        <FormattedMessage
                            id='search_box_suggestions.suggestions_readout'
                            defaultMessage='{label} ({idx} of {total} results available)'
                            values={{
                                label: generateLabel(providerResults.items[selectedOption]),
                                idx: selectedOption + 1,
                                total: providerResults.items.length,
                            }}
                        />
                    </div>
                )} */}
                <SuggestionListList id={id}>
                    {contents}
                </SuggestionListList>
                {/* SuggestionsListStatus? */}
            </SuggestionsBody>
        );
    }

    const pluginComponentInfo = searchPluginSuggestions.find(({pluginId}) => {
        if (searchType === pluginId) {
            return true;
        }
        return false;
    });

    if (!pluginComponentInfo) {
        return null;
    }

    const Component = pluginComponentInfo.component;

    return (
        <ErrorBoundary>
            <Component
                key={pluginComponentInfo.pluginId}
                searchTerms={searchTerms}
                onChangeSearch={onSuggestionSelected}
                onRunSearch={runSearch}
            />
        </ErrorBoundary>
    );
};

export default SearchSuggestions;

