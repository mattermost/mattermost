// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {autocompleteChannelsForSearchInTeam} from 'actions/channel_actions';
import {autocompleteUsersInTeam} from 'actions/user_actions';

import type {ProviderResult} from 'components/suggestion/provider';
import type Provider from 'components/suggestion/provider';
import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchUserProvider from 'components/suggestion/search_user_provider';

import {SearchFileExtensionProvider} from './extension_suggestions_provider';

const useSearchSuggestions = (searchType: string, searchTerms: string, searchTeam: string, caretPosition: number, getCaretPosition: () => number, setSelectedOption: (idx: number) => void): [ProviderResult<unknown>|null, React.ReactNode] => {
    const dispatch = useDispatch();

    const [providerResults, setProviderResults] = useState<ProviderResult<unknown>|null>(null);
    const [suggestionsHeader, setSuggestionsHeader] = useState<React.ReactNode>(<span/>);

    const suggestionProviders = useRef<Provider[]>([
        new SearchDateProvider(),
        new SearchChannelProvider((term: string, teamId: string, success?: (channels: Channel[]) => void, error?: (err: ServerError) => void) => dispatch(autocompleteChannelsForSearchInTeam(term, teamId, success, error))),
        new SearchUserProvider((username: string, teamId: string) => dispatch(autocompleteUsersInTeam(username, teamId))),
        new SearchFileExtensionProvider(),
    ]);

    const headers = useMemo<React.ReactNode[]>(() => [
        <span key={1}/>,
        <FormattedMessage
            id='search_bar.channels'
            defaultMessage='Channels'
            key={2}
        />,
        <FormattedMessage
            id='search_bar.users'
            defaultMessage='Users'
            key={3}
        />,
        <FormattedMessage
            id='search_bar.file_types'
            defaultMessage='File types'
            key={4}
        />,
    ], []);

    useEffect(() => {
        setProviderResults(null);
        if (searchType !== '' && searchType !== 'messages' && searchType !== 'files') {
            return;
        }

        const partialSearchTerms = searchTerms.slice(0, caretPosition);
        if (searchTerms.length > caretPosition && searchTerms[caretPosition] !== ' ') {
            return;
        }

        if (caretPosition > 0 && searchTerms[caretPosition - 1] === ' ') {
            return;
        }

        suggestionProviders.current.forEach((provider, idx) => {
            provider.handlePretextChanged(partialSearchTerms, (res: ProviderResult<unknown>) => {
                if (idx === 3 && searchType !== 'files') {
                    return;
                }
                if (caretPosition !== getCaretPosition()) {
                    return;
                }
                res.items = res.items.slice(0, 10);
                res.terms = res.terms.slice(0, 10);
                setProviderResults(res);
                setSelectedOption(0);
                setSuggestionsHeader(headers[idx]);
            }, searchTeam);
        });
    }, [searchTerms, searchTeam, searchType, caretPosition]);

    return [providerResults, suggestionsHeader];
};

export default useSearchSuggestions;
