// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {Group} from '@mattermost/types/groups';

import Permissions from 'mattermost-redux/constants/permissions';
import {getDefaultAgent} from 'mattermost-redux/selectors/entities/agents';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';
import {makeGetProfilesForThread} from 'mattermost-redux/selectors/entities/posts';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';

import AtMentionProvider from 'components/suggestion/at_mention_provider';
import ChannelMentionProvider from 'components/suggestion/channel_mention_provider';
import CommandProvider from 'components/suggestion/command_provider/command_provider';
import EmoticonProvider from 'components/suggestion/emoticon_provider';
import SuggestionList from 'components/suggestion/suggestion_list';
import type {ProviderResults, SuggestionResults} from 'components/suggestion/suggestion_results';
import {normalizeResultsFromProvider, countResults} from 'components/suggestion/suggestion_results';

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

function getAllTerms(results: SuggestionResults): string[] {
    if ('terms' in results) {
        return results.terms;
    }
    if ('groups' in results) {
        return results.groups.flatMap((group) => group.terms);
    }
    return [];
}

function getTextBeforeCursor(editor: Editor): string {
    const {state} = editor;
    const {from} = state.selection;
    const currentNode = state.selection.$from;

    const startOfLine = currentNode.start();
    return state.doc.textBetween(startOfLine, from, '\n');
}

const WysiwygSuggestionList = ({editor, channelId, rootId}: Props) => {
    const dispatch = useDispatch();

    const [results, setResults] = useState<SuggestionResults>(EMPTY_RESULTS);
    const [pretext, setPretext] = useState('');
    const [selection, setSelection] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const editorDomRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            editorDomRef.current = editor.view.dom as HTMLDivElement;
        }
    }, [editor]);

    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);
    const license = useSelector(getLicense);
    const config = useSelector(getConfig);
    const defaultAgent = useSelector(getDefaultAgent);

    const useGroupMentions = license?.IsLicensed === 'true' && license?.LDAPGroups === 'true';
    const autocompleteGroups = useSelector((state: GlobalState) => {
        if (useGroupMentions && haveIChannelPermission(state, currentTeamId, channelId, Permissions.USE_GROUP_MENTIONS)) {
            return getAssociatedGroupsForReference(state, currentTeamId, channelId);
        }
        return null;
    });

    const getProfilesForThread = useMemo(() => makeGetProfilesForThread(), []);
    const priorityProfiles = useSelector((state: GlobalState) => getProfilesForThread(state, rootId ?? ''));
    const delayChannelAutocomplete = config.DelayChannelAutocomplete === 'true';

    const matchedPretextRef = useRef('');

    const providers = useMemo(() => {
        return [
            new CommandProvider({
                teamId: currentTeamId,
                channelId,
                rootId,
            }),
            new AtMentionProvider({
                currentUserId,
                channelId,
                autocompleteUsersInChannel: (prefix: string) => dispatch(autocompleteUsersInChannel(prefix, channelId)),
                useChannelMentions: true,
                autocompleteGroups,
                searchAssociatedGroupsForReference: (prefix: string) => dispatch(searchAssociatedGroupsForReference(prefix, currentTeamId, channelId)) as Promise<ActionResult<Group[]>>,
                priorityProfiles,
                defaultAgent,
            }),
            new ChannelMentionProvider(
                (term: string, success: (channels: Channel[]) => void, error: (err: ServerError) => void) => dispatch(autocompleteChannels(term, success, error)),
                delayChannelAutocomplete,
            ),
            new EmoticonProvider(),
        ];
    }, [dispatch, currentUserId, channelId, rootId, currentTeamId, autocompleteGroups, priorityProfiles, defaultAgent, delayChannelAutocomplete]);

    const handleReceivedSuggestions = useCallback((suggestions: ProviderResults) => {
        const normalized = normalizeResultsFromProvider(suggestions);
        const terms = getAllTerms(normalized);

        setResults(normalized);
        setPretext(suggestions.matchedPretext || '');
        matchedPretextRef.current = suggestions.matchedPretext || '';

        if (countResults(normalized) > 0 && terms.length > 0) {
            setSelection(terms[0]);
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return undefined;
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

        const completedText = `${term} `;

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
            return undefined;
        }

        const editorElement = editor.view.dom;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpenRef.current) {
                return;
            }

            const allTerms = getAllTerms(resultsRef.current);
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
        <SuggestionList
            inputRef={editorDomRef as React.RefObject<HTMLDivElement>}
            open={isOpen}
            pretext={pretext}
            cleared={false}
            results={results}
            selection={selection}
            onCompleteWord={handleCompleteWord}
            onItemHover={handleItemHover}
            position='top'
        />
    );
};

export default WysiwygSuggestionList;
