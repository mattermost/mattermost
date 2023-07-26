// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import {useIntl} from 'react-intl';
import {EmoticonPlusOutlineIcon} from '@mattermost/compass-icons/components';

import {Post} from '@mattermost/types/posts';
import {Emoji, SystemEmoji} from '@mattermost/types/emojis';

import {AppEvents, Constants, ModalIdentifiers, StoragePrefixes} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {
    formatGithubCodePaste,
    formatMarkdownMessage,
    getHtmlTable,
    hasHtmlLink,
    isGitHubCodeBlock,
} from 'utils/paste';
import {postMessageOnKeyPress, splitMessageBasedOnCaretPosition} from 'utils/post_utils';
import {applyMarkdown, ApplyMarkdownOptions} from 'utils/markdown/apply_markdown';
import * as Utils from 'utils/utils';

import DeletePostModal from 'components/delete_post_modal';
import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import Textbox, {TextboxClass, TextboxElement} from 'components/textbox';
import {ModalData} from 'types/actions';
import {PostDraft} from '../../types/store/draft';

import EditPostFooter from './edit_post_footer';
import {ActionResult} from 'mattermost-redux/types/actions';

type DialogProps = {
    post?: Post;
    isRHS?: boolean;
};

export type Actions = {
    addMessageIntoHistory: (message: string) => void;
    editPost: (input: Partial<Post>) => Promise<Post>;
    setDraft: (name: string, value: PostDraft | null) => void;
    unsetEditingPost: () => void;
    openModal: (input: ModalData<DialogProps>) => void;
    scrollPostListToBottom: () => void;
    getPostEditHistory: (postId: string) => void;
    runMessageWillBeUpdatedHooks: (newPost: Partial<Post>, oldPost: Post) => Promise<ActionResult>;
}

export type Props = {
    canEditPost?: boolean;
    canDeletePost?: boolean;
    readOnlyChannel?: boolean;
    teamId: string;
    channelId: string;
    codeBlockOnCtrlEnter: boolean;
    ctrlSend: boolean;
    draft: PostDraft;
    config: {
        EnableEmojiPicker?: string;
        EnableGifPicker?: string;
    };
    maxPostSize: number;
    useChannelMentions: boolean;
    editingPost: {
        post: Post | null;
        postId?: string;
        refocusId?: string;
        title?: string;
        isRHS?: boolean;
    };
    isRHSOpened: boolean;
    isEditHistoryShowing: boolean;
    actions: Actions;
};

export type State = {
    editText: string;
    selectionRange: {start: number; end: number};
    postError: React.ReactNode;
    errorClass: string | null;
    showEmojiPicker: boolean;
    renderScrollbar: boolean;
    scrollbarWidth: number;
    prevShowState: boolean;
};

const {KeyCodes} = Constants;

const TOP_OFFSET = 0;
const RIGHT_OFFSET = 10;

const EditPost = ({editingPost, actions, canEditPost, config, channelId, draft, ...rest}: Props): JSX.Element | null => {
    const [editText, setEditText] = useState<string>(
        draft.message || editingPost?.post?.message_source || editingPost?.post?.message || '',
    );
    const [selectionRange, setSelectionRange] = useState<State['selectionRange']>({start: editText.length, end: editText.length});
    const [postError, setPostError] = useState<React.ReactNode | null>(null);
    const [errorClass, setErrorClass] = useState<string>('');
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [renderScrollbar, setRenderScrollbar] = useState<boolean>(false);

    const textboxRef = useRef<TextboxClass>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // using a ref here makes sure that the unmounting callback (saveDraft) is fired with the correct value.
    // If we would just use the editText value from the state it would be a stale since it is encapsuled in the
    // function closure on initial render
    const draftRef = useRef<PostDraft>(draft);
    const saveDraftFrame = useRef<number|null>();

    const draftStorageId = `${StoragePrefixes.EDIT_DRAFT}${editingPost.postId}`;

    const {formatMessage} = useIntl();

    const saveDraft = useCallback(() => {
        // to be run on unmount and only when there is an active saveDraftFrame timer
        if (saveDraftFrame.current && editingPost.postId) {
            actions.setDraft(draftStorageId, draftRef.current);
            clearTimeout(saveDraftFrame.current);
            saveDraftFrame.current = null;
        }
    }, [actions, draftStorageId, editingPost.postId]);

    useEffect(() => saveDraft, [saveDraft]);

    useEffect(() => {
        if (saveDraftFrame.current) {
            clearTimeout(saveDraftFrame.current);
        }

        saveDraftFrame.current = window.setTimeout(() => {
            actions.setDraft(draftStorageId, draftRef.current);
        }, Constants.SAVE_DRAFT_TIMEOUT);
    }, [actions, draftStorageId, editText]);

    useEffect(() => {
        const focusTextBox = () => textboxRef?.current?.focus();

        document.addEventListener(AppEvents.FOCUS_EDIT_TEXTBOX, focusTextBox);
        return () => document.removeEventListener(AppEvents.FOCUS_EDIT_TEXTBOX, focusTextBox);
    }, []);

    useEffect(() => {
        if (selectionRange.start === selectionRange.end) {
            Utils.setCaretPosition(textboxRef.current?.getInputBox(), selectionRange.start);
        } else {
            Utils.setSelectionRange(textboxRef.current?.getInputBox(), selectionRange.start, selectionRange.end);
        }
    }, [selectionRange]);

    // just a helper so it's not always needed to update with setting both properties to the same value
    const setCaretPosition = (position: number) => setSelectionRange({start: position, end: position});

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const {clipboardData, target} = e;
        if (
            !clipboardData ||
            !clipboardData.items ||
            !canEditPost ||
            (target as HTMLTextAreaElement).id !== 'edit_textbox'
        ) {
            return;
        }

        const hasLinks = hasHtmlLink(clipboardData);
        const table = getHtmlTable(clipboardData);
        if (!table && !hasLinks) {
            return;
        }

        e.preventDefault();

        let message = editText;
        let newCaretPosition = selectionRange.start;

        if (table && isGitHubCodeBlock(table.className)) {
            const {formattedMessage, formattedCodeBlock} = formatGithubCodePaste({selectionStart: (target as any).selectionStart, selectionEnd: (target as any).selectionEnd, message, clipboardData});
            message = formattedMessage;
            newCaretPosition = selectionRange.start + formattedCodeBlock.length;
        } else {
            message = formatMarkdownMessage(clipboardData, editText.trim(), newCaretPosition).formattedMessage;
            newCaretPosition = message.length - (editText.length - newCaretPosition);
        }

        setEditText(message);
        setCaretPosition(newCaretPosition);
    }, [canEditPost, selectionRange, editText]);

    const isSaveDisabled = () => {
        const {post} = editingPost;
        const hasAttachments = post && post.file_ids && post.file_ids.length > 0;

        if (hasAttachments) {
            return !canEditPost;
        }

        if (editText.trim() !== '') {
            return !canEditPost;
        }

        return !rest.canDeletePost;
    };

    const applyHotkeyMarkdown = (params: ApplyMarkdownOptions) => {
        if (params.selectionStart === null || params.selectionEnd === null) {
            return;
        }

        const res = applyMarkdown(params);

        setEditText(res.message);
        setSelectionRange({start: res.selectionStart, end: res.selectionEnd});
    };

    const handleRefocusAndExit = (refocusId: string|null) => {
        if (refocusId) {
            const element = document.getElementById(refocusId);
            element?.focus();
        }

        actions.unsetEditingPost();
    };

    const handleAutomatedRefocusAndExit = () => {
        draftRef.current = {
            ...draftRef.current,
            message: '',
        };
        handleRefocusAndExit(editingPost.refocusId || null);
    };

    const handleEdit = async () => {
        if (!editingPost.post || isSaveDisabled()) {
            return;
        }

        let updatedPost = {
            message: editText,
            id: editingPost.postId,
            channel_id: editingPost.post.channel_id,
        };

        const hookResult = await actions.runMessageWillBeUpdatedHooks(updatedPost, editingPost.post);
        if (hookResult.error && hookResult.error.message) {
            setPostError(<>{hookResult.error.message}</>);
            return;
        }

        updatedPost = hookResult.data;

        if (postError) {
            setErrorClass('animation--highlight');
            setTimeout(() => setErrorClass(''), Constants.ANIMATION_TIMEOUT);
            return;
        }

        if (updatedPost.message === (editingPost.post?.message_source || editingPost.post?.message)) {
            handleAutomatedRefocusAndExit();
            return;
        }

        const hasAttachment = Boolean(
            editingPost.post?.file_ids && editingPost.post?.file_ids.length > 0,
        );
        if (updatedPost.message.trim().length === 0 && !hasAttachment) {
            handleRefocusAndExit(null);

            const deletePostModalData = {
                modalId: ModalIdentifiers.DELETE_POST,
                dialogType: DeletePostModal,
                dialogProps: {
                    post: editingPost.post,
                    isRHS: editingPost.isRHS,
                },
            };

            actions.openModal(deletePostModalData);
            return;
        }

        await actions.editPost(updatedPost as Post);
        if (rest.isRHSOpened && rest.isEditHistoryShowing) {
            actions.getPostEditHistory(editingPost.postId || '');
        }

        handleAutomatedRefocusAndExit();
    };

    const handleEditKeyPress = (e: React.KeyboardEvent) => {
        const {ctrlSend, codeBlockOnCtrlEnter} = rest;
        const inputBox = textboxRef.current?.getInputBox();

        const {allowSending, ignoreKeyPress} = postMessageOnKeyPress(
            e,
            editText,
            ctrlSend,
            codeBlockOnCtrlEnter,
            Date.now(),
            0,
            inputBox.selectionStart,
        );

        if (ignoreKeyPress) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (allowSending && textboxRef.current) {
            e.preventDefault();
            textboxRef.current.blur();
            handleEdit();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<TextboxElement>) => {
        const {ctrlSend, codeBlockOnCtrlEnter} = rest;

        const ctrlOrMetaKeyPressed = e.ctrlKey || e.metaKey;
        const ctrlKeyCombo = Keyboard.cmdOrCtrlPressed(e) && !e.altKey && !e.shiftKey;
        const ctrlAltCombo = Keyboard.cmdOrCtrlPressed(e, true) && e.altKey;
        const ctrlEnterKeyCombo =
            (ctrlSend || codeBlockOnCtrlEnter) &&
            Keyboard.isKeyPressed(e, KeyCodes.ENTER) &&
            ctrlOrMetaKeyPressed;
        const markdownLinkKey = Keyboard.isKeyPressed(e, KeyCodes.K);

        // listen for line break key combo and insert new line character
        if (Utils.isUnhandledLineBreakKeyCombo(e)) {
            e.stopPropagation(); // perhaps this should happen in all of these cases? or perhaps Modal should not be listening?
            setEditText(Utils.insertLineBreakFromKeyEvent(e as React.KeyboardEvent<HTMLTextAreaElement>));
        } else if (ctrlEnterKeyCombo) {
            handleEdit();
        } else if (Keyboard.isKeyPressed(e, KeyCodes.ESCAPE) && !showEmojiPicker) {
            handleAutomatedRefocusAndExit();
        } else if (ctrlAltCombo && markdownLinkKey) {
            applyHotkeyMarkdown({
                markdownMode: 'link',
                selectionStart: e.currentTarget.selectionStart,
                selectionEnd: e.currentTarget.selectionEnd,
                message: e.currentTarget.value,
            });
        } else if (ctrlKeyCombo && Keyboard.isKeyPressed(e, KeyCodes.B)) {
            applyHotkeyMarkdown({
                markdownMode: 'bold',
                selectionStart: e.currentTarget.selectionStart,
                selectionEnd: e.currentTarget.selectionEnd,
                message: e.currentTarget.value,
            });
        } else if (ctrlKeyCombo && Keyboard.isKeyPressed(e, KeyCodes.I)) {
            applyHotkeyMarkdown({
                markdownMode: 'italic',
                selectionStart: e.currentTarget.selectionStart,
                selectionEnd: e.currentTarget.selectionEnd,
                message: e.currentTarget.value,
            });
        }
    };

    const handleChange = (e: React.ChangeEvent<TextboxElement>) => {
        const message = e.target.value;

        draftRef.current = {
            ...draftRef.current,
            message,
        };

        setEditText(message);
    };

    const handleHeightChange = (height: number, maxHeight: number) => setRenderScrollbar(height > maxHeight);

    const handlePostError = (_postError: React.ReactNode) => {
        if (_postError !== postError) {
            setPostError(_postError);
        }
    };

    const hideEmojiPicker = () => {
        setShowEmojiPicker(false);
        textboxRef.current?.focus();
    };

    const handleEmojiClick = (emoji?: Emoji) => {
        const emojiAlias = emoji && (((emoji as SystemEmoji).short_names && (emoji as SystemEmoji).short_names[0]) || emoji.name);

        if (!emojiAlias) {
            //Oops.. There went something wrong
            return;
        }

        let newMessage = `:${emojiAlias}: `;
        let newCaretPosition = newMessage.length;

        if (editText.length > 0) {
            const {firstPiece, lastPiece} = splitMessageBasedOnCaretPosition(
                selectionRange.start,
                editText,
            );

            // check whether the first piece of the message is empty when cursor
            // is placed at beginning of message and avoid adding an empty string at the beginning of the message
            newMessage = firstPiece === '' ? `:${emojiAlias}: ${lastPiece}` : `${firstPiece} :${emojiAlias}: ${lastPiece}`;
            newCaretPosition = firstPiece === '' ? `:${emojiAlias}: `.length : `${firstPiece} :${emojiAlias}: `.length;
        }

        draftRef.current = {
            ...draftRef.current,
            message: newMessage,
        };

        setEditText(newMessage);
        setCaretPosition(newCaretPosition);
        setShowEmojiPicker(false);
        textboxRef.current?.focus();
    };

    const handleGifClick = (gif: string) => {
        let newMessage = gif;

        if (editText.length > 0) {
            newMessage = (/\s+$/).test(editText) ? `${editText}${gif}` : `${editText} ${gif}`;
        }

        draftRef.current = {
            ...draftRef.current,
            message: newMessage,
        };

        setEditText(newMessage);
        setShowEmojiPicker(false);
        textboxRef.current?.focus();
    };

    const toggleEmojiPicker = (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e?.stopPropagation();
        setShowEmojiPicker(!showEmojiPicker);
        if (showEmojiPicker) {
            textboxRef.current?.focus();
        }
    };

    const getEmojiContainerRef = useCallback(() => textboxRef.current, [textboxRef]);
    const getEmojiTargetRef = useCallback(() => emojiButtonRef.current, [emojiButtonRef]);

    let emojiPicker = null;
    const emojiButtonAriaLabel = formatMessage({
        id: 'emoji_picker.emojiPicker',
        defaultMessage: 'Emoji Picker',
    }).toLowerCase();

    if (config.EnableEmojiPicker === 'true') {
        emojiPicker = (
            <>
                <EmojiPickerOverlay
                    show={showEmojiPicker}
                    container={getEmojiContainerRef}
                    target={getEmojiTargetRef}
                    onHide={hideEmojiPicker}
                    onEmojiClick={handleEmojiClick}
                    onGifClick={handleGifClick}
                    enableGifPicker={config.EnableGifPicker === 'true'}
                    topOffset={TOP_OFFSET}
                    rightOffset={RIGHT_OFFSET}
                />
                <button
                    aria-label={emojiButtonAriaLabel}
                    id='editPostEmoji'
                    ref={emojiButtonRef}
                    className='style--none post-action'
                    onClick={toggleEmojiPicker}
                >
                    <EmoticonPlusOutlineIcon
                        size={18}
                        color='currentColor'
                    />
                </button>
            </>
        );
    }

    return (
        <div
            className={classNames('post--editing__wrapper', {
                scroll: renderScrollbar,
            })}
            ref={wrapperRef}
        >
            <Textbox
                tabIndex={0}
                rootId={editingPost.post ? Utils.getRootId(editingPost.post) : ''}
                onChange={handleChange}
                onKeyPress={handleEditKeyPress}
                onKeyDown={handleKeyDown}
                onHeightChange={handleHeightChange}
                handlePostError={handlePostError}
                onPaste={handlePaste}
                value={editText}
                channelId={channelId}
                emojiEnabled={config.EnableEmojiPicker === 'true'}
                createMessage={formatMessage({id: 'edit_post.editPost', defaultMessage: 'Edit the post...'})}
                supportsCommands={false}
                suggestionListPosition='bottom'
                id='edit_textbox'
                ref={textboxRef}
                characterLimit={rest.maxPostSize}
                useChannelMentions={rest.useChannelMentions}
            />
            <div className='post-body__actions'>
                {emojiPicker}
            </div>
            <EditPostFooter
                onSave={handleEdit}
                onCancel={handleAutomatedRefocusAndExit}
            />
            {postError && (
                <div className={classNames('edit-post-footer', {'has-error': postError})}>
                    <label className={classNames('post-error', errorClass)}>{postError}</label>
                </div>
            )}
        </div>
    );
};

export default EditPost;
