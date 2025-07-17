// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getSearchPluginSuggestions} from 'selectors/plugins';

import {SuggestionListStatus} from 'components/suggestion/suggestion_list';
import {SuggestionListContents} from 'components/suggestion/suggestion_list_structure';
import type {SuggestionResults} from 'components/suggestion/suggestion_results';
import {hasResults} from 'components/suggestion/suggestion_results';

import ErrorBoundary from 'plugins/pluggable/error_boundary';

const SuggestionsBody = styled.div`
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding-bottom: 16px;

    .suggestion-list__divider {
        margin-top: 16px;
        padding: 8px 24px;
    }

    ul[role="group"], ul[role="listbox"] {
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
    results: SuggestionResults<unknown>;
    onSearch: (searchType: string, searchTeam: string, searchTerms: string) => void;
    onSuggestionSelected: (value: string, matchedPretext: string) => void;
}

const SearchSuggestions = ({
    id,
    searchType,
    searchTeam,
    searchTerms,
    results,
    selectedTerm,
    setSelectedTerm,
    onSearch,
    onSuggestionSelected,
}: Props) => {
    const runSearch = useCallback((searchTerms: string) => {
        onSearch(searchType, searchTeam, searchTerms);
    }, [onSearch, searchTeam, searchType]);

    const searchPluginSuggestions = useSelector(getSearchPluginSuggestions);

    // const generateLabel = (item: any) => { // TODO label items directly
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

    const getItemId = useCallback((term) => `searchBoxSuggestions_item_${term}`, []);

    if (searchType === '' || searchType === 'messages' || searchType === 'files') {
        if (!hasResults(results)) {
            return null;
        }

        return (
            <SuggestionsBody>
                <SuggestionListContents
                    id={id}

                    results={results}
                    selectedTerm={selectedTerm}

                    getItemId={getItemId}
                    onItemClick={onSuggestionSelected}
                    onItemHover={setSelectedTerm}
                />
                <SuggestionListStatus results={results}/>
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

