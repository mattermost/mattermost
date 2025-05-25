// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import {useCallback, useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import {emitShortcutReactToLastPostFrom, unsetEditingPost} from 'actions/post_actions';
import {editLatestPost} from 'actions/views/create_comment';
import {replyToLatestPostInChannel} from 'actions/views/rhs';
import {getIsRhsExpanded} from 'selectors/rhs';

import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';

import Constants, {A11yClassNames, Locations, Preferences} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {type ApplyMarkdownOptions} from 'utils/markdown/apply_markdown';
import {pasteHandler} from 'utils/paste';
import {isWithinCodeBlock, postMessageOnKeyPress} from 'utils/post_utils';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

const KeyCodes = Constants.KeyCodes;

const useKeyHandler = (
    draft: PostDraft,
    channelId: string,
    postId: string,
    caretPosition: number,
    isValidPersistentNotifications: boolean,
    location: string,
    textboxRef: React.RefObject<TextboxClass>,
    showFormattingBar: boolean,
    focusTextbox: (forceFocus?: boolean) => void,
    applyMarkdown: (params: ApplyMarkdownOptions) => void,
    handleDraftChange: (draft: PostDraft, options?: {instant?: boolean; show?: boolean}) => void,
    handleSubmit: (submittingDraft?: PostDraft, schedulingInfo?: SchedulingInfo) => void,
    emitTypingEvent: () => void,
    toggleShowPreview: () => void,
    toggleAdvanceTextEditor: () => void,
    toggleEmojiPicker: () => void,
    isInEditMode?: boolean,
    onCancel?: () => void,
): [
        (e: React.KeyboardEvent<TextboxElement>) => void,
        (e: React.KeyboardEvent<TextboxElement>) => void,
    ] => {
    const dispatch = useDispatch();

    const ctrlSend = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'));
    const codeBlockOnCtrlEnter = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', true));
    const messageHistory = useSelector((state: GlobalState) => state.entities.posts.messagesHistory.messages);
    const rhsExpanded = useSelector(getIsRhsExpanded);

    const timeoutId = useRef<number>();
    const messageHistoryIndex = useRef(messageHistory.length);
    const lastChannelSwitchAt = useRef(0);
    const isNonFormattedPaste = useRef(false);

    const replyToLastPost = useCallback((e: React.KeyboardEvent) => {
        if (postId) {
            return;
        }

        e.preventDefault();
        const replyBox = document.getElementById('reply_textbox');
        if (replyBox) {
            replyBox.focus();
        }

        dispatch(replyToLatestPostInChannel(channelId));
    }, [dispatch, postId, channelId]);

    const onEditLatestPost = useCallback((e: React.KeyboardEvent) => {
        e.preventDefault();
        const {data: canEditNow} = dispatch(editLatestPost(channelId, postId));
        if (!canEditNow) {
            focusTextbox(true);
        }
    }, [focusTextbox, channelId, postId, dispatch]);

    const loadPrevMessage = useCallback((e: React.KeyboardEvent) => {
        e.preventDefault();
        if (messageHistoryIndex.current === 0) {
            return;
        }
        messageHistoryIndex.current -= 1;
        handleDraftChange({
            ...draft,
            message: messageHistory[messageHistoryIndex.current] || '',
        });
    }, [draft, handleDraftChange, messageHistory]);

    const loadNextMessage = useCallback((e: React.KeyboardEvent) => {
        e.preventDefault();
        if (messageHistoryIndex.current >= messageHistory.length) {
            return;
        }
        messageHistoryIndex.current += 1;
        handleDraftChange({
            ...draft,
            message: messageHistory[messageHistoryIndex.current] || '',
        });
    }, [draft, handleDraftChange, messageHistory]);

    const postMsgKeyPress = useCallback((e: React.KeyboardEvent<TextboxElement>) => {
        const {allowSending, withClosedCodeBlock, ignoreKeyPress, message} = postMessageOnKeyPress(
            e,
            draft.message,
            ctrlSend,
            codeBlockOnCtrlEnter,
            postId ? 0 : Date.now(),
            postId ? 0 : lastChannelSwitchAt.current,
            caretPosition,
        );

        if (ignoreKeyPress) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (allowSending && isValidPersistentNotifications) {
            e.preventDefault();
            const updatedDraft = (withClosedCodeBlock && message) ? {...draft, message} : undefined;
            handleSubmit(updatedDraft);
        }

        emitTypingEvent();
    }, [draft, ctrlSend, codeBlockOnCtrlEnter, caretPosition, postId, emitTypingEvent, handleSubmit, isValidPersistentNotifications]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<TextboxElement>) => {
        const ctrlOrMetaKeyPressed = e.ctrlKey || e.metaKey;
        const ctrlEnterKeyCombo = (ctrlSend || codeBlockOnCtrlEnter) &&
            Keyboard.isKeyPressed(e, KeyCodes.ENTER) &&
            ctrlOrMetaKeyPressed;

        const ctrlKeyCombo = Keyboard.cmdOrCtrlPressed(e) && !e.altKey && !e.shiftKey;
        const ctrlAltCombo = Keyboard.cmdOrCtrlPressed(e, true) && e.altKey;
        const shiftAltCombo = !Keyboard.cmdOrCtrlPressed(e) && e.shiftKey && e.altKey;
        const ctrlShiftCombo = Keyboard.cmdOrCtrlPressed(e, true) && e.shiftKey;

        // fix for FF not capturing the paste without formatting event when using ctrl|cmd + shift + v
        if (e.key === KeyCodes.V[0] && ctrlOrMetaKeyPressed) {
            if (e.shiftKey) {
                isNonFormattedPaste.current = true;
                timeoutId.current = window.setTimeout(() => {
                    isNonFormattedPaste.current = false;
                }, 250);
            }
        }

        if ((Keyboard.isKeyPressed(e, KeyCodes.PAGE_UP) || Keyboard.isKeyPressed(e, KeyCodes.PAGE_DOWN))) {
            // Moving the focus to the post list will cause the post list to scroll as if it already had focus
            // before the key was pressed
            if (location === Locations.CENTER) {
                document.getElementById('postListScrollContainer')?.focus();
            } else if (location === Locations.RHS_COMMENT) {
                document.getElementById('threadViewerScrollContainer')?.focus();
            }
        }

        // listen for line break key combo and insert new line character
        if (Utils.isUnhandledLineBreakKeyCombo(e)) {
            handleDraftChange({
                ...draft,
                message: Utils.insertLineBreakFromKeyEvent(e.nativeEvent),
            });
            return;
        }

        if (ctrlEnterKeyCombo) {
            postMsgKeyPress(e);
            return;
        }

        if (Keyboard.isKeyPressed(e, KeyCodes.ESCAPE)) {
            textboxRef.current?.blur();
            if (isInEditMode) {
                onCancel?.();
                dispatch(unsetEditingPost());
            }
        }

        const upKeyOnly = !ctrlOrMetaKeyPressed && !e.altKey && !e.shiftKey && Keyboard.isKeyPressed(e, KeyCodes.UP);
        const messageIsEmpty = draft.message.length === 0;
        const allowHistoryNavigation = draft.message.length === 0 || draft.message === messageHistory[messageHistoryIndex.current];
        const caretIsWithinCodeBlock = caretPosition && isWithinCodeBlock(draft.message, caretPosition); // REVIEW

        if (upKeyOnly && messageIsEmpty) {
            e.preventDefault();
            if (textboxRef.current) {
                textboxRef.current.blur();
            }

            onEditLatestPost(e);
        }

        const {
            selectionStart,
            selectionEnd,
            value,
        } = e.target as TextboxElement;

        if (ctrlKeyCombo && !caretIsWithinCodeBlock) {
            if (allowHistoryNavigation && Keyboard.isKeyPressed(e, KeyCodes.UP)) {
                e.stopPropagation();
                e.preventDefault();
                loadPrevMessage(e);
            } else if (allowHistoryNavigation && Keyboard.isKeyPressed(e, KeyCodes.DOWN)) {
                e.stopPropagation();
                e.preventDefault();
                loadNextMessage(e);
            } else if (Keyboard.isKeyPressed(e, KeyCodes.B)) {
                e.stopPropagation();
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'bold',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            } else if (Keyboard.isKeyPressed(e, KeyCodes.I)) {
                e.stopPropagation();
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'italic',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            } else if (Utils.isTextSelectedInPostOrReply(e) && Keyboard.isKeyPressed(e, KeyCodes.K)) {
                e.stopPropagation();
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'link',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            }
        } else if (ctrlAltCombo && !caretIsWithinCodeBlock) {
            if (Keyboard.isKeyPressed(e, KeyCodes.K)) {
                e.stopPropagation();
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'link',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            } else if (Keyboard.isKeyPressed(e, KeyCodes.C)) {
                e.stopPropagation();
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'code',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            } else if (Keyboard.isKeyPressed(e, KeyCodes.E)) {
                e.stopPropagation();
                e.preventDefault();
                toggleEmojiPicker();
            } else if (Keyboard.isKeyPressed(e, KeyCodes.T)) {
                e.stopPropagation();
                e.preventDefault();
                toggleAdvanceTextEditor();
            } else if (Keyboard.isKeyPressed(e, KeyCodes.P) && draft.message.length && !UserAgent.isMac() && showFormattingBar) {
                e.stopPropagation();
                e.preventDefault();
                toggleShowPreview();
            }
        } else if (shiftAltCombo && !caretIsWithinCodeBlock) {
            if (Keyboard.isKeyPressed(e, KeyCodes.X)) {
                e.stopPropagation();
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'strike',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            } else if (Keyboard.isKeyPressed(e, KeyCodes.SEVEN)) {
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'ol',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            } else if (Keyboard.isKeyPressed(e, KeyCodes.EIGHT)) {
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'ul',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            } else if (Keyboard.isKeyPressed(e, KeyCodes.NINE)) {
                e.preventDefault();
                applyMarkdown({
                    markdownMode: 'quote',
                    selectionStart,
                    selectionEnd,
                    message: value,
                });
            }
        } else if (ctrlShiftCombo && !caretIsWithinCodeBlock) {
            if (Keyboard.isKeyPressed(e, KeyCodes.P) && draft.message.length && UserAgent.isMac()) { // REVIEW
                e.stopPropagation();
                e.preventDefault();
                toggleShowPreview();
            } else if (Keyboard.isKeyPressed(e, KeyCodes.E)) {
                e.stopPropagation();
                e.preventDefault();
                toggleEmojiPicker();
            }
        }

        const lastMessageReactionKeyCombo = ctrlShiftCombo && Keyboard.isKeyPressed(e, KeyCodes.BACK_SLASH);
        if (lastMessageReactionKeyCombo) {
            // we need to stop propagating and prevent default even if a
            // post is being edited so the document level event handler doesn't trigger
            e.stopPropagation();
            e.preventDefault();

            if (!isInEditMode) {
                // don't show the reaction dialog if a post is being edited
                dispatch(emitShortcutReactToLastPostFrom(postId ? Locations.RHS_ROOT : Locations.CENTER));
            }
        }

        if (!postId) {
            const shiftUpKeyCombo = !ctrlOrMetaKeyPressed && !e.altKey && e.shiftKey && Keyboard.isKeyPressed(e, KeyCodes.UP);
            if (shiftUpKeyCombo && messageIsEmpty) {
                replyToLastPost?.(e);
            }
        }
    }, [
        applyMarkdown,
        caretPosition,
        codeBlockOnCtrlEnter,
        ctrlSend,
        dispatch,
        draft,
        handleDraftChange,
        loadNextMessage,
        loadPrevMessage,
        messageHistory,
        onEditLatestPost,
        postId,
        postMsgKeyPress,
        replyToLastPost,
        textboxRef,
        toggleAdvanceTextEditor,
        toggleEmojiPicker,
        toggleShowPreview,
    ]);

    // Register paste events
    useEffect(() => {
        function onPaste(event: ClipboardEvent) {
            pasteHandler(event, location, draft.message, isNonFormattedPaste.current, caretPosition);
        }

        document.addEventListener('paste', onPaste);
        return () => {
            document.removeEventListener('paste', onPaste);
        };
    }, [location, draft.message, caretPosition]);

    const reactToLastMessage = useCallback((e: KeyboardEvent) => {
        e.preventDefault();

        const noModalsAreOpen = document.getElementsByClassName(A11yClassNames.MODAL).length === 0;
        const noPopupsDropdownsAreOpen = document.getElementsByClassName(A11yClassNames.POPUP).length === 0;

        // Block keyboard shortcut react to last message when :
        // - RHS is completely expanded
        // - Any dropdown/popups are open
        // - Any modals are open
        if (!rhsExpanded && noModalsAreOpen && noPopupsDropdownsAreOpen) {
            dispatch(emitShortcutReactToLastPostFrom(Locations.CENTER));
        }
    }, [dispatch, rhsExpanded]);

    useEffect(() => {
        const documentKeyHandler = (e: KeyboardEvent) => {
            const ctrlOrMetaKeyPressed = e.ctrlKey || e.metaKey;
            const lastMessageReactionKeyCombo = ctrlOrMetaKeyPressed && e.shiftKey && Keyboard.isKeyPressed(e, KeyCodes.BACK_SLASH);
            if (lastMessageReactionKeyCombo) {
                reactToLastMessage(e);
            }
        };

        if (!postId) {
            document.addEventListener('keydown', documentKeyHandler);
        }

        return () => {
            if (!postId) {
                document.removeEventListener('keydown', documentKeyHandler);
            }
        };
    }, [postId, reactToLastMessage]);

    // Reset history index
    useEffect(() => {
        if (messageHistoryIndex.current === messageHistory.length) {
            return;
        }
        if (draft.message !== messageHistory[messageHistoryIndex.current]) {
            messageHistoryIndex.current = messageHistory.length;
        }
    }, [draft.message]);

    useEffect(() => {
        messageHistoryIndex.current = messageHistory.length;
    }, [messageHistory]);

    // Update last channel switch at
    useEffect(() => {
        lastChannelSwitchAt.current = Date.now();
    }, [channelId]);

    return [handleKeyDown, postMsgKeyPress];
};

export default useKeyHandler;
