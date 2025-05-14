// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import type {UserProfile} from '@mattermost/types/users';

import {getSearchPluginSuggestions} from 'selectors/plugins';

import type {ProviderResult} from 'components/suggestion/provider';
import type {SuggestionProps} from 'components/suggestion/suggestion';

import ErrorBoundary from 'plugins/pluggable/error_boundary';

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
    searchTeam: string;
    searchTerms: string;
    selectedOption: number;
    setSelectedOption: (idx: number) => void;
    suggestionsHeader: React.ReactNode;
    providerResults: ProviderResult<unknown> | null;
    onSearch: (searchType: string, searchTeam: string, searchTerms: string) => void;
    onSuggestionSelected: (value: string, matchedPretext: string) => void;
}

const SearchSuggestions = ({searchType, searchTeam, searchTerms, suggestionsHeader, providerResults, selectedOption, setSelectedOption, onSearch, onSuggestionSelected}: Props) => {
    const runSearch = useCallback((searchTerms: string) => {
        onSearch(searchType, searchTeam, searchTerms);
    }, [onSearch, searchTeam, searchType]);

    const searchPluginSuggestions = useSelector(getSearchPluginSuggestions);

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

    if (searchType === '' || searchType === 'messages' || searchType === 'files') {
        if (!providerResults) {
            return null;
        }

        return (
            <SuggestionsBody>
                <SuggestionsHeader>{suggestionsHeader}</SuggestionsHeader>
                {providerResults.component && providerResults.items[selectedOption] && (
                    <div
                        aria-live='polite'
                        role='alert'
                        className='sr-only'
                        key={providerResults.terms[selectedOption]}
                    >
                        {generateLabel(providerResults.items[selectedOption])}
                    </div>
                )}
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
                            onClick={onSuggestionSelected}
                            onMouseMove={() => {
                                setSelectedOption(idx);
                            }}
                        />
                    );
                })}
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

