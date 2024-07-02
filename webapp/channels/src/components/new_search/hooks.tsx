// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {autocompleteChannelsForSearch} from 'actions/channel_actions';
import {autocompleteUsersInTeam} from 'actions/user_actions';

import type {ProviderResult} from 'components/suggestion/provider';
import type Provider from 'components/suggestion/provider';
import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchChannelSuggestion from 'components/suggestion/search_channel_suggestion';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchDateSuggestion from 'components/suggestion/search_date_suggestion';
import SearchUserProvider, {SearchUserSuggestion} from 'components/suggestion/search_user_provider';

import SearchFileExtensionSuggestion from './extension_suggestions';
import {SearchFileExtensionProvider} from './extension_suggestions_provider';

const useSearchSuggestions = (searchType: string, searchTerms: string, setSelectedOption: (idx: number) => void): [ProviderResult<unknown>|null, React.ReactNode] => {
    const dispatch = useDispatch();

    const [providerResults, setProviderResults] = useState<ProviderResult<unknown>|null>(null);
    const [suggestionsHeader, setSuggestionsHeader] = useState<React.ReactNode>(<span/>);

    const suggestionProviders = useRef<Provider[]>([
        new SearchDateProvider(),
        new SearchChannelProvider((term: string, success?: (channels: Channel[]) => void, error?: (err: ServerError) => void) => dispatch(autocompleteChannelsForSearch(term, success, error))),
        new SearchUserProvider((username: string) => dispatch(autocompleteUsersInTeam(username))),
        new SearchFileExtensionProvider(),
    ]);

    useEffect(() => {
        setProviderResults(null);
        if (searchType !== '' && searchType !== 'messages' && searchType !== 'files') {
            return;
        }

        suggestionProviders.current[0].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchDateSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
            setSuggestionsHeader(<span/>);
        });
        suggestionProviders.current[1].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchChannelSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
            setSuggestionsHeader(
                <FormattedMessage
                    id='search_bar.channels'
                    defaultMessage='Channels'
                />,
            );
        });
        suggestionProviders.current[2].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchUserSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
            setSuggestionsHeader(
                <FormattedMessage
                    id='search_bar.users'
                    defaultMessage='Users'
                />,
            );
        });
        suggestionProviders.current[3].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            if (searchType !== 'files') {
                return;
            }
            res.component = SearchFileExtensionSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
            setSuggestionsHeader(
                <FormattedMessage
                    id='search_bar.file_types'
                    defaultMessage='File types'
                />,
            );
        });
    }, [searchTerms, searchType]);

    return [providerResults, suggestionsHeader];
};

export default useSearchSuggestions;
