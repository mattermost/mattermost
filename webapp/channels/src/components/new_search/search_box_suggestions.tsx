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
    getCaretPosition: () => number;
    selectedOption: number;
    setSelectedOption: (idx: number) => void;
    suggestionsHeader: React.ReactNode;
    providerResults: ProviderResult<unknown>|null;
    focus: (newPosition: number) => void;
    onSearch: (searchType: string, searchTerms: string) => void;
}

const SearchSuggestions = ({searchType, searchTerms, setSearchTerms, getCaretPosition, suggestionsHeader, providerResults, selectedOption, setSelectedOption, focus, onSearch}: Props) => {
    const license = useSelector(getLicense);
    const updateSearchValue = useCallback((value: string, matchedPretext: string) => {
        const caretPosition = getCaretPosition();
        const extraSpace = caretPosition === searchTerms.length ? ' ' : '';
        setSearchTerms(searchTerms.slice(0, caretPosition).replace(matchedPretext, '') + value +  extraSpace + searchTerms.slice(caretPosition));
        focus(caretPosition + value.length + 1 - matchedPretext.length);
    }, [searchTerms, setSearchTerms, focus, getCaretPosition]);

    const runSearch = useCallback((searchTerms: string) => {
        onSearch(searchType, searchTerms);
    }, [onSearch, searchType]);

    let SearchPluginSuggestions = useSelector((state: GlobalState) => state.plugins.components.SearchSuggestions) || [];
    if (license.IsLicensed !== 'true') {
        SearchPluginSuggestions = [];
    }

    const generateLabel = (item: any) => {
        let label = '';
        if (item.username) {
            label = item.username;
            if ((item.first_name || item.last_name) && item.nickname) {
                label += ` ${item.first_name} ${item.last_name} ${item.nickname}`;
            } else if (item.nickname) {
                label += ` ${item.nickname}`;
            } else if (item.first_name || item.last_name) {
                label += ` ${item.first_name} ${item.last_name}`;
            }
        } else if (item.type === 'D' || item.type === 'G') {
            label = item.display_name;
        } else if (item.type === 'P' || item.type === 'O') {
            label = item.name;
        } else if (item.emoji) {
            label = item.name;
        }

        if (label) {
            label = label.toLowerCase();
        }
        return label;
    };

    if ((searchType === '' || searchType === 'messages' || searchType === 'files') && providerResults) {
        return (
            <SuggestionsBody>
                <SuggestionsHeader>{suggestionsHeader}</SuggestionsHeader>
                {providerResults.items.map((item, idx) => {
                    if (!providerResults.component) {
                        return null;
                    }
                    if (idx !== selectedOption) {
                        return null;
                    }
                    return (
                        <div
                            aria-live='polite'
                            role='alert'
                            className='sr-only'
                            key={providerResults.terms[idx]}
                        >
                            {idx === selectedOption ? generateLabel(item) : ''}
                        </div>
                    );
                })}
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

