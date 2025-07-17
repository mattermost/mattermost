// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {autocompleteChannelsForSearchInTeam} from 'actions/channel_actions';
import {autocompleteUsersInTeam} from 'actions/user_actions';

import type Provider from 'components/suggestion/provider';
import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchUserProvider from 'components/suggestion/search_user_provider';
import type {ProviderResults, SuggestionResults} from 'components/suggestion/suggestion_results';
import {emptyResults, flattenTerms, normalizeResultsFromProvider, trimResults} from 'components/suggestion/suggestion_results';

import {SearchFileExtensionProvider} from './extension_suggestions_provider';

export const useSearchSuggestions = (searchType: string, searchTerms: string, searchTeam: string, caretPosition: number, getCaretPosition: () => number): SuggestionResults<unknown> => {
    const dispatch = useDispatch();

    const [results, setResults] = useState<SuggestionResults<unknown>>(emptyResults());

    const suggestionProviders = useRef<Provider[]>([
        new SearchDateProvider(),
        new SearchChannelProvider((term: string, teamId: string, success?: (channels: Channel[]) => void, error?: (err: ServerError) => void) => dispatch(autocompleteChannelsForSearchInTeam(term, teamId, success, error))),
        new SearchUserProvider((username: string, teamId: string) => dispatch(autocompleteUsersInTeam(username, teamId))),
        new SearchFileExtensionProvider(),
    ]);

    // const headers = useMemo<React.ReactNode[]>(() => [ // TODO remove divider logic
    //     <span key={1}/>,
    //     <FormattedMessage
    //         id='search_bar.channels'
    //         defaultMessage='Channels'
    //         key={2}
    //     />,
    //     <FormattedMessage
    //         id='search_bar.users'
    //         defaultMessage='Users'
    //         key={3}
    //     />,
    //     <FormattedMessage
    //         id='search_bar.file_types'
    //         defaultMessage='File types'
    //         key={4}
    //     />,
    // ], []);

    useEffect(() => {
        setResults(emptyResults());
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
            provider.handlePretextChanged(partialSearchTerms, (res: ProviderResults<unknown>) => {
                if (idx === 3 && searchType !== 'files') {
                    return;
                }
                if (caretPosition !== getCaretPosition()) {
                    return;
                }

                let trimmedResults = normalizeResultsFromProvider(res);
                trimmedResults = trimResults(trimmedResults, 10);

                setResults(trimmedResults);
            }, searchTeam);
        });
    }, [searchTerms, searchTeam, searchType, caretPosition]);

    return results;
};

export function useSearchSuggestionSelection(results: SuggestionResults<unknown>) {
    const [selectedTerm, setSelectedTerm] = useState('');

    const flattenedTerms = useMemo(() => flattenTerms(results), [results]);

    // Logic

    useEffect(() => {
        // Unlike the SuggestionBox, this always resets the selection when suggestions changes. This is probably
        // much more reliable than the SuggestionBox's behaviour.
        setSelectedTerm(flattenedTerms.length > 0 ? flattenedTerms[0] : '');
    }, [flattenedTerms]);

    // Callbacks

    const clearSelection = useCallback(() => {
        setSelectedTerm('');
    }, []);

    const setSelectionByDelta = useCallback((delta: number) => {
        const selectionIndex = flattenedTerms.indexOf(selectedTerm);
        if (selectionIndex === -1) {
            setSelectedTerm('');
        } else {
            let nextSelectionIndex = selectionIndex + delta;

            // Keyboard selection doesn't wrap around
            nextSelectionIndex = Math.min(Math.max(nextSelectionIndex, 0), flattenedTerms.length - 1);

            setSelectedTerm(flattenedTerms[nextSelectionIndex]);
        }
    }, [selectedTerm, flattenedTerms]);

    return {
        selectedTerm,

        clearSelection,
        setSelectedTerm,
        setSelectionByDelta,
    };
}
