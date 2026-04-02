// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSelector} from 'react-redux';

import Permissions from 'mattermost-redux/constants/permissions';
import {getAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';
import {makeGetProfilesForThread} from 'mattermost-redux/selectors/entities/posts';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getDefaultAgent} from 'mattermost-redux/selectors/entities/agents';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';
import store from 'stores/redux_store';

import AtMentionProvider from 'components/suggestion/at_mention_provider';
import ChannelMentionProvider from 'components/suggestion/channel_mention_provider';
import EmoticonProvider from 'components/suggestion/emoticon_provider';
import SuggestionList from 'components/suggestion/suggestion_list';
import type {SuggestionResults} from 'components/suggestion/suggestion_results';
import {normalizeResultsFromProvider} from 'components/suggestion/suggestion_results';

import type {GlobalState} from 'types/store';

interface Props {
    editor: Editor | null;
    channelId: string;
    rootId?: string;
}

const EMPTY_RESULTS: SuggestionResults = {
    matchedPretext: '',
    terms: [],
    items: [],
    components: [],
};

function getTextBeforeCursor(editor: Editor): string {
    const {state} = editor;
    const {from} = state.selection;
    const currentNode = state.selection.$from;

    const startOfLine = currentNode.start();
    return state.doc.textBetween(startOfLine, from, '\n');
}

const WysiwygSuggestionList = ({editor, channelId, rootId}: Props) => {
    const [results, setResults] = useState<SuggestionResults>(EMPTY_RESULTS);
    const [pretext, setPretext] = useState('');
    const [selection, setSelection] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);
    const license = useSelector(getLicense);
    const config = useSelector(getConfig);
    const defaultAgent = useSelector(getDefaultAgent);

    const useGroupMentions = license?.IsLicensed === 'true' && license?.LDAPGroups === 'true';
    const autocompleteGroups = useSelector((state: GlobalState) =>
        (useGroupMentions && haveIChannelPermission(state, currentTeamId, channelId, Permissions.USE_GROUP_MENTIONS)) ?
            getAssociatedGroupsForReference(state, currentTeamId, channelId) :
            null,
    );

    const getProfilesForThread = useMemo(makeGetProfilesForThread, []);
    const priorityProfiles = useSelector((state: GlobalState) => getProfilesForThread(state, rootId ?? ''));
    const delayChannelAutocomplete = config.DelayChannelAutocomplete === 'true';

    const containerRef = useRef<HTMLDivElement>(null);
    const matchedPretextRef = useRef('');

    const providers = useMemo(() => {
        const dispatch = store.dispatch;
        return [
            new AtMentionProvider({
                currentUserId,
                channelId,
                autocompleteUsersInChannel: (prefix: string) => dispatch(autocompleteUsersInChannel(prefix, channelId)),
                useChannelMentions: true,
                autocompleteGroups,
                searchAssociatedGroupsForReference: (prefix: string) => dispatch(searchAssociatedGroupsForReference(prefix, currentTeamId, channelId)),
                priorityProfiles,
                defaultAgent,
            }),
            new ChannelMentionProvider(
                (term: string, success: (channels: any) => void, error: (err: any) => void) => dispatch(autocompleteChannels(term, success, error)),
                delayChannelAutocomplete,
            ),
            new EmoticonProvider(),
        ];
    }, [currentUserId, channelId, currentTeamId, autocompleteGroups, priorityProfiles, defaultAgent, delayChannelAutocomplete]);

    const handleReceivedSuggestions = useCallback((suggestions: any) => {
        const normalized = normalizeResultsFromProvider(suggestions);
        const terms = 'terms' in normalized ? normalized.terms : [];

        setResults(normalized);
        setPretext(suggestions.matchedPretext || '');
        matchedPretextRef.current = suggestions.matchedPretext || '';

        if (terms.length > 0) {
            setSelection(terms[0]);
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return;
        }

        const handleUpdate = () => {
            const text = getTextBeforeCursor(editor);

            let handled = false;
            for (const provider of providers) {
                handled = provider.handlePretextChanged(text, handleReceivedSuggestions);
                if (handled) {
                    break;
                }
            }
            if (!handled) {
                setIsOpen(false);
                setResults(EMPTY_RESULTS);
            }
        };

        editor.on('selectionUpdate', handleUpdate);
        editor.on('update', handleUpdate);

        return () => {
            editor.off('selectionUpdate', handleUpdate);
            editor.off('update', handleUpdate);
        };
    }, [editor, providers, handleReceivedSuggestions]);

    const handleCompleteWord = useCallback((term: string, matchedPretext: string) => {
        if (!editor || editor.isDestroyed) {
            return false;
        }

        const {state} = editor;
        const {from} = state.selection;
        const cursorNode = state.selection.$from;
        const startOfLine = cursorNode.start();
        const textBeforeCursor = state.doc.textBetween(startOfLine, from, '\n');

        const matchIndex = textBeforeCursor.lastIndexOf(matchedPretext);
        if (matchIndex === -1) {
            setIsOpen(false);
            return false;
        }

        const deleteFrom = startOfLine + matchIndex;
        const deleteTo = from;

        const completedText = term.endsWith(':') ? `${term} ` : `${term} `;

        editor.chain().focus().deleteRange({from: deleteFrom, to: deleteTo}).insertContent(completedText).run();

        setIsOpen(false);
        setResults(EMPTY_RESULTS);
        return true;
    }, [editor]);

    const handleItemHover = useCallback((term: string) => {
        setSelection(term);
    }, []);

    const isOpenRef = useRef(isOpen);
    const selectionRef = useRef(selection);
    const resultsRef = useRef(results);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        selectionRef.current = selection;
    }, [selection]);

    useEffect(() => {
        resultsRef.current = results;
    }, [results]);

    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return;
        }

        const editorElement = editor.view.dom;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpenRef.current) {
                return;
            }

            const allTerms = 'terms' in resultsRef.current ? resultsRef.current.terms : [];
            if (allTerms.length === 0) {
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                const currentIndex = allTerms.indexOf(selectionRef.current);
                const nextIndex = (currentIndex + 1) % allTerms.length;
                setSelection(allTerms[nextIndex]);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                const currentIndex = allTerms.indexOf(selectionRef.current);
                const nextIndex = currentIndex <= 0 ? allTerms.length - 1 : currentIndex - 1;
                setSelection(allTerms[nextIndex]);
                return;
            }

            if (event.key === 'Tab' || event.key === 'Enter') {
                if (selectionRef.current && matchedPretextRef.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    handleCompleteWord(selectionRef.current, matchedPretextRef.current);
                    return;
                }
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen(false);
            }
        };

        editorElement.addEventListener('keydown', handleKeyDown, true);

        return () => {
            editorElement.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [editor, handleCompleteWord]);

    if (!isOpen || !editor) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            style={{position: 'relative'}}
        >
            <SuggestionList
                open={isOpen}
                pretext={pretext}
                cleared={false}
                results={results}
                selection={selection}
                onCompleteWord={handleCompleteWord}
                onItemHover={handleItemHover}
                position='top'
            />
        </div>
    );
};

export default WysiwygSuggestionList;
