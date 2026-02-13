// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {getSearchBoxHints} from 'selectors/plugins';

import SearchDateSuggestion from 'components/suggestion/search_date_suggestion';
import {hasResults, hasSuggestionWithComponent, type SuggestionResults} from 'components/suggestion/suggestion_results';

import ErrorBoundary from 'plugins/pluggable/error_boundary';

import SearchHints from './search_hint';

type Props = {
    searchTerms: string;
    searchTeam: string;
    setSearchTerms: (searchTerms: string) => void;
    searchType: string;
    selectedTerm: string;
    results: SuggestionResults;
    focus: (pos: number) => void;
}

const SearchBoxHints = ({searchTerms, searchTeam, setSearchTerms, searchType, results, selectedTerm, focus}: Props) => {
    const filterSelectedCallback = useCallback((filter: string) => {
        if (searchTerms.endsWith(' ') || searchTerms.length === 0) {
            setSearchTerms(searchTerms + filter);
            focus(searchTerms.length + filter.length);
        } else {
            setSearchTerms(searchTerms + ' ' + filter);
            focus(searchTerms.length + filter.length + 1);
        }
    }, [searchTerms, setSearchTerms, focus]);

    const searchChangeCallback = useCallback((value: string, matchedPretext: string) => {
        const changedValue = value.replace(matchedPretext, '');
        setSearchTerms(searchTerms + changedValue + ' ');
        focus(searchTerms.length + changedValue.length + 1);
    }, [searchTerms, setSearchTerms, focus]);

    const searchPluginHints = useSelector(getSearchBoxHints);

    if (searchType === '' || searchType === 'messages' || searchType === 'files') {
        return (
            <SearchHints
                onSelectFilter={filterSelectedCallback}
                searchType={searchType}
                searchTerms={searchTerms}
                searchTeam={searchTeam}
                hasSelectedOption={hasResults(results) && selectedTerm !== ''}
                isDate={hasSuggestionWithComponent(results, SearchDateSuggestion)}
            />
        );
    }

    const pluginComponentInfo = searchPluginHints.find(({pluginId}: any) => {
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
                onChangeSearch={searchChangeCallback}
                searchTerms={searchTerms}
            />
        </ErrorBoundary>
    );
};

export default SearchBoxHints;
