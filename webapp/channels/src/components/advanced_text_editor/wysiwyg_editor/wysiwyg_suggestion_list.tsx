// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {Group} from '@mattermost/types/groups';

import {addMessageIntoHistory} from 'mattermost-redux/actions/posts';
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

import Constants from 'utils/constants';
import {getPxToSubstract} from 'utils/utils';

import type {GlobalState} from 'types/store';

const EXECUTE_CURRENT_COMMAND_ITEM_ID = Constants.Integrations.EXECUTE_CURRENT_COMMAND_ITEM_ID;
const OPEN_COMMAND_IN_MODAL_ITEM_ID = Constants.Integrations.OPEN_COMMAND_IN_MODAL_ITEM_ID;

interface Props {
    editor: Editor | null;
    channelId: string;
    rootId?: string;
    onSubmit?: () => void;
}

type AppsModalProvider = {
    openAppsModalFromCommand: (command: string) => void;
};

const canOpenAppsModal = <T extends object>(provider: T): provider is T & AppsModalProvider =>
    typeof (provider as T & AppsModalProvider).openAppsModalFromCommand === 'function';

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

function getTriggerPos(editor: Editor, matchedPretext: string): number | null {
    const startOfLine = editor.state.selection.$from.start();
    const text = getTextBeforeCursor(editor);

    // Mention/channel/emoji providers lowercase matchedPretext. The trigger is
    // always the suffix before the caret, matching SuggestionBox.
    if (!text.toLowerCase().endsWith(matchedPretext.toLowerCase())) {
        return null;
    }

    return startOfLine + text.length - matchedPretext.length;
}

type SuggestionBoxAlignment = {
    lineHeight: number;
    pixelsToMoveX: number;
    pixelsToMoveY: number;
};

/**
 * The suggestion list is absolutely positioned against the top left corner of the editor, so SuggestionList needs
 * the offset of the trigger character within the editor to render it under the caret instead of in that corner.
 */
function getTriggerAlignment(editor: Editor, triggerPos: number, triggerCharacter: string): SuggestionBoxAlignment | undefined {
    const {view} = editor;

    let coords;
    try {
        coords = view.coordsAtPos(triggerPos);
    } catch {
        return undefined;
    }

    const editorRect = view.dom.getBoundingClientRect();
    const maxOffsetX = Math.max(editorRect.width - Constants.SUGGESTION_LIST_MAXWIDTH, 0);
    const offsetX = coords.left - editorRect.left - getPxToSubstract(triggerCharacter);

    return {
        lineHeight: parseInt(getComputedStyle(view.dom).lineHeight, 10) || 0,
        pixelsToMoveX: Math.round(Math.min(Math.max(offsetX, 0), maxOffsetX)),
        pixelsToMoveY: Math.round(coords.top - editorRect.top),
    };
}

const WysiwygSuggestionList = ({editor, channelId, rootId, onSubmit}: Props) => {
    const dispatch = useDispatch();

    const [results, setResults] = useState<SuggestionResults>(EMPTY_RESULTS);
    const [pretext, setPretext] = useState('');
    const [selection, setSelection] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [suggestionBoxAlgn, setSuggestionBoxAlgn] = useState<SuggestionBoxAlignment>();

    const editorDomRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<Editor | null>(null);
    useEffect(() => {
        editorRef.current = editor;
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
    const alignedTriggerPosRef = useRef<number | null>(null);

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

    const handleReceivedSuggestions = useCallback((suggestions: ProviderResults, triggerCharacter = '') => {
        const normalized = normalizeResultsFromProvider(suggestions);
        const terms = getAllTerms(normalized);
        const matchedPretext = suggestions.matchedPretext || '';

        setResults(normalized);
        setPretext(matchedPretext);
        matchedPretextRef.current = matchedPretext;

        if (countResults(normalized) > 0 && terms.length > 0) {
            setSelection(terms[0]);

            const currentEditor = editorRef.current;
            if (currentEditor && !currentEditor.isDestroyed) {
                const triggerPos = getTriggerPos(currentEditor, matchedPretext);

                // Measure once per trigger so the list stays put while the search term is typed, but follows
                // the caret again as soon as another trigger character opens it somewhere else.
                if (triggerPos !== null && triggerPos !== alignedTriggerPosRef.current) {
                    alignedTriggerPosRef.current = triggerPos;
                    setSuggestionBoxAlgn(getTriggerAlignment(currentEditor, triggerPos, triggerCharacter));
                }
            }

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
                handled = provider.handlePretextChanged(text, (suggestions) => handleReceivedSuggestions(suggestions, provider.triggerCharacter));
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

    const closeSuggestions = useCallback(() => {
        setIsOpen(false);
        setResults(EMPTY_RESULTS);
    }, []);

    const handleCompleteWord = useCallback((term: string, matchedPretext: string) => {
        if (!editor || editor.isDestroyed) {
            return false;
        }

        if (term.endsWith(EXECUTE_CURRENT_COMMAND_ITEM_ID)) {
            closeSuggestions();
            editor.commands.focus();
            onSubmit?.();
            return true;
        }

        if (term.endsWith(OPEN_COMMAND_IN_MODAL_ITEM_ID)) {
            closeSuggestions();

            const command = term.slice(0, -OPEN_COMMAND_IN_MODAL_ITEM_ID.length);
            const appProvider = providers.find(canOpenAppsModal);
            if (!appProvider) {
                return false;
            }

            appProvider.openAppsModalFromCommand(command);
            dispatch(addMessageIntoHistory(command));
            editor.chain().focus().clearContent().run();
            return false;
        }

        const {from} = editor.state.selection;
        const triggerPos = getTriggerPos(editor, matchedPretext);
        if (triggerPos === null) {
            setIsOpen(false);
            return false;
        }

        const completedText = `${term} `;

        editor.chain().focus().deleteRange({from: triggerPos, to: from}).insertContent(completedText).run();

        closeSuggestions();
        return true;
    }, [editor, providers, dispatch, onSubmit, closeSuggestions]);

    const handleItemHover = useCallback((term: string) => {
        setSelection(term);
    }, []);

    const isOpenRef = useRef(isOpen);
    const selectionRef = useRef(selection);
    const resultsRef = useRef(results);

    useEffect(() => {
        isOpenRef.current = isOpen;

        if (!isOpen) {
            // Re-measure the next time the list opens since the composer may have moved in the meantime.
            alignedTriggerPosRef.current = null;
        }
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
            inputRef={editorDomRef as React.RefObject<HTMLDivElement | null>}
            open={isOpen}
            pretext={pretext}
            cleared={false}
            results={results}
            selection={selection}
            suggestionBoxAlgn={suggestionBoxAlgn}
            onCompleteWord={handleCompleteWord}
            onItemHover={handleItemHover}
            position='top'
        />
    );
};

export default WysiwygSuggestionList;
