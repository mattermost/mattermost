// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import type {ProviderResult} from 'components/suggestion/provider';
import SearchDateSuggestion from 'components/suggestion/search_date_suggestion';

import ErrorBoundary from 'plugins/pluggable/error_boundary';

import type {GlobalState} from 'types/store';

import SearchHints from './search_hint';

type Props = {
    searchTerms: string;
    setSearchTerms: (searchTerms: string) => void;
    searchType: string;
    selectedOption: number;
    providerResults: ProviderResult<unknown>|null;
    focus: (pos: number) => void;
}

const SearchBoxHints = ({searchTerms, setSearchTerms, searchType, providerResults, selectedOption, focus}: Props) => {
    const license = useSelector(getLicense);
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

    const SearchPluginHintsList = useSelector((state: GlobalState) => state.plugins.components.SearchHints) || [];
    const SearchPluginHints = useMemo(() => {
        if (license.IsLicensed !== 'true') {
            return [];
        }
        return SearchPluginHintsList;
    }, [SearchPluginHintsList, license.IsLicensed]);

    if (searchType === '' || searchType === 'messages' || searchType === 'files') {
        return (
            <SearchHints
                onSelectFilter={filterSelectedCallback}
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
