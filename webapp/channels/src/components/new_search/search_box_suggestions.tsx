// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import type {UserProfile} from '@mattermost/types/users';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import type {ProviderResult} from 'components/suggestion/provider';
import type {SuggestionProps} from 'components/suggestion/suggestion';

import ErrorBoundary from 'plugins/pluggable/error_boundary';

import type {GlobalState} from 'types/store';

const SuggestionsHeader = styled.div`
    margin-top: 16px;
    padding: 8px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    text-transform: uppercase;
`;

const SuggestionsBody = styled.div`
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding-bottom: 16px;
`;

type Props = {
    searchType: string;
    searchTerms: string;
    setSearchTerms: (searchTerms: string) => void;
    selectedOption: number;
    setSelectedOption: (idx: number) => void;
    suggestionsHeader: React.ReactNode;
    providerResults: ProviderResult<unknown>|null;
    focus: (newPosition: number) => void;
    onSearch: (searchType: string, searchTerms: string) => void;
}

const SearchSuggestions = ({searchType, searchTerms, setSearchTerms, suggestionsHeader, providerResults, selectedOption, setSelectedOption, focus, onSearch}: Props) => {
    const license = useSelector(getLicense);
    const updateSearchValue = useCallback((value: string, matchedPretext: string) => {
        const changedValue = value.replace(matchedPretext, '');
        setSearchTerms(searchTerms + changedValue + ' ');
        focus(searchTerms.length + changedValue.length + 1);
    }, [searchTerms, setSearchTerms, focus]);

    const runSearch = useCallback((searchTerms: string) => {
        onSearch(searchType, searchTerms);
    }, [onSearch, searchType]);

    let SearchPluginSuggestions = useSelector((state: GlobalState) => state.plugins.components.SearchSuggestions) || [];
    if (license.IsLicensed !== 'true') {
        SearchPluginSuggestions = [];
    }

    if ((searchType === '' || searchType === 'messages' || searchType === 'files') && providerResults) {
        return (
            <SuggestionsBody>
                <SuggestionsHeader>{suggestionsHeader}</SuggestionsHeader>
                {providerResults.items.map((item, idx) => {
                    if (!providerResults.component) {
                        return null;
                    }
                    const Component = providerResults.component as React.ComponentType<SuggestionProps<any>>;
                    return (
                        <Component
                            key={providerResults.terms[idx]}
                            item={item as UserProfile}
                            term={providerResults.terms[idx]}
                            matchedPretext={providerResults.matchedPretext}
                            isSelection={idx === selectedOption}
                            onClick={updateSearchValue}
                            onMouseMove={() => {
                                setSelectedOption(idx);
                            }}
                        />
                    );
                })}
            </SuggestionsBody>
        );
    }

    const pluginComponentInfo = SearchPluginSuggestions.find(({pluginId}: any) => {
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
                searchTerms={searchTerms}
                onChangeSearch={updateSearchValue}
                onRunSearch={runSearch}
            />
        </ErrorBoundary>
    );
};

export default SearchSuggestions;

