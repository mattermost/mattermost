// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import SearchDateSuggestion from 'components/suggestion/search_date_suggestion';

import type {GlobalState} from 'types/store';

import SearchHints from './search_hint';

const SearchBoxHints = ({searchTerms, setSearchTerms, searchType, providerResults, selectedOption, focus}: any) => {
    const SearchPluginHints = useSelector((state: GlobalState) => state.plugins.components.SearchHints) || [];

    if (searchType === '' || searchType === 'messages' || searchType === 'files') {
        return (
            <SearchHints
                onSelectFilter={(filter: string) => {
                    if (searchTerms.endsWith(' ') || searchTerms.length === 0) {
                        setSearchTerms(searchTerms + filter);
                        focus(searchTerms.length + filter.length);
                    } else {
                        setSearchTerms(searchTerms + ' ' + filter);
                        focus(searchTerms.length + filter.length + 1);
                    }
                }}
                searchType={searchType}
                searchTerms={searchTerms}
                hasSelectedOption={Boolean(providerResults && providerResults.items.length > 0 && selectedOption !== -1)}
                isDate={providerResults?.component === SearchDateSuggestion}
            />
        );
    }

    const pluginComponentInfo = SearchPluginHints.find(({pluginId}: any) => {
        if (searchType === pluginId) {
            return true;
        }
        return false;
    });

    if (!pluginComponentInfo) {
        return null;
    }

    const Component: any = pluginComponentInfo.component;

    return (
        <Component
            key={pluginComponentInfo.pluginId}
            onChangeSearch={(value: string, matchedPretext: string) => {
                const changedValue = value.replace(matchedPretext, '');
                setSearchTerms(searchTerms + changedValue + ' ');
                focus(searchTerms.length + changedValue.length + 1);
            }}
            searchTerms={searchTerms}
        />
    );
};

export default SearchBoxHints;
