// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {EmoticonHappyOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';
import type {Emoji} from '@mattermost/types/emojis';
import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo} from '@mattermost/types/files';

import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import LocalStorageStore from 'stores/local_storage_store';

import AutoHeightSwitcher from 'components/common/auto_height_switcher';
import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import FilePreview from 'components/file_preview';
import type {FilePreviewInfo} from 'components/file_preview/file_preview';
import FileUpload from 'components/file_upload';
import type {FileUpload as FileUploadClass} from 'components/file_upload/file_upload';
import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import MessageSubmitError from 'components/message_submit_error';
import MsgTyping from 'components/msg_typing';
import OverlayTrigger from 'components/overlay_trigger';
import RhsSuggestionList from 'components/suggestion/rhs_suggestion_list';
import SuggestionList from 'components/suggestion/suggestion_list';
import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';
import Tooltip from 'components/tooltip';
import {SendMessageTour} from 'components/tours/onboarding_tour';

import Constants, {Locations} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import type {ApplyMarkdownOptions} from 'utils/markdown/apply_markdown';
import {pasteHandler} from 'utils/paste';
import {isWithinCodeBlock} from 'utils/post_utils';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';

import type {PostDraft} from 'types/store/draft';

import FormattingBar from './formatting_bar';
import {FormattingBarSpacer, Separator} from './formatting_bar/formatting_bar';
import {IconContainer} from './formatting_bar/formatting_icon';
import SendButton from './send_button';
import ShowFormat from './show_formatting';
import TexteditorActions from './texteditor_actions';
import ToggleFormattingBar from './toggle_formatting_bar';

import './advanced_text_editor.scss';

const KeyCodes = Constants.KeyCodes;

type Props = {

    /**
     * location of the advanced text editor in the UI (center channel / RHS)
     */
    location: string;
    currentUserId: string;
    message: string;
    showEmojiPicker: boolean;
    uploadsProgressPercent: { [clientID: string]: FilePreviewInfo };
    currentChannel?: Channel;
    errorClass: string | null;
    serverError: (ServerError & { submittedMessage?: string }) | null;
    postError?: React.ReactNode;
    isFormattingBarHidden: boolean;
    draft: PostDraft;
    showSendTutorialTip?: boolean;
    handleSubmit: (e: React.FormEvent) => void;
    removePreview: (id: string) => void;
    setShowPreview: (newPreviewValue: boolean) => void;
    shouldShowPreview: boolean;
    maxPostSize: number;
    canPost: boolean;
    applyMarkdown: (params: ApplyMarkdownOptions) => void;
    useChannelMentions: boolean;
    badConnection: boolean;
    currentChannelTeammateUsername?: string;
    canUploadFiles: boolean;
    enableEmojiPicker: boolean;
    enableGifPicker: boolean;
    handleBlur: () => void;
    handlePostError: (postError: React.ReactNode) => void;
    emitTypingEvent: () => void;
    handleMouseUpKeyUp: (e: React.MouseEvent<TextboxElement> | React.KeyboardEvent<TextboxElement>) => void;
    postMsgKeyPress: (e: React.KeyboardEvent<TextboxElement>) => void;
    handleChange: (e: React.ChangeEvent<TextboxElement>) => void;
    toggleEmojiPicker: () => void;
    handleGifClick: (gif: string) => void;
    handleEmojiClick: (emoji: Emoji) => void;
    hideEmojiPicker: () => void;
    toggleAdvanceTextEditor: () => void;
    handleUploadProgress: (filePreviewInfo: FilePreviewInfo) => void;
    handleUploadError: (err: string | ServerError | null, clientId?: string, channelId?: string) => void;
    handleFileUploadComplete: (fileInfos: FileInfo[], clientIds: string[], channelId: string, rootId?: string) => void;
    handleUploadStart: (clientIds: string[], channelId: string) => void;
    handleFileUploadChange: () => void;
    getFileUploadTarget: () => HTMLInputElement | null;
    fileUploadRef: React.RefObject<FileUploadClass>;
    prefillMessage?: (message: string, shouldFocus?: boolean) => void;
    channelId: string;
    postId: string;
    textboxRef: React.RefObject<TextboxClass>;
    isThreadView?: boolean;
    additionalControls?: React.ReactNodeArray;
    labels?: React.ReactNode;
    disableSend?: boolean;
    ctrlSend?: boolean;
    codeBlockOnCtrlEnter?: boolean;
    onMessageChange: (message: string, callback?: () => void) => void;
    onEditLatestPost: (e: React.KeyboardEvent) => void;
    loadPrevMessage: (e: React.KeyboardEvent) => void;
    loadNextMessage: (e: React.KeyboardEvent) => void;
    replyToLastPost?: (e: React.KeyboardEvent) => void;
    caretPosition: number;
    placeholder?: string;
}

const AdvanceTextEditor = ({
    location,
    message,
    showEmojiPicker,
    uploadsProgressPercent,
    currentChannel,
    channelId,
    postId,
    errorClass,
    serverError,
    postError,
    isFormattingBarHidden,
    draft,
    badConnection,
    handleSubmit,
    removePreview,
    showSendTutorialTip,
    setShowPreview,
    shouldShowPreview,
    maxPostSize,
    canPost,
    applyMarkdown,
    useChannelMentions,
    currentChannelTeammateUsername,
    currentUserId,
    canUploadFiles,
    enableEmojiPicker,
    enableGifPicker,
    handleBlur: onBlur,
    handlePostError,
    emitTypingEvent,
    handleMouseUpKeyUp,
    postMsgKeyPress,
    handleChange,
    toggleEmojiPicker,
    handleGifClick,
    handleEmojiClick,
    hideEmojiPicker,
    toggleAdvanceTextEditor,
    handleUploadProgress,
    handleUploadError,
    handleFileUploadComplete,
    handleUploadStart,
    handleFileUploadChange,
    getFileUploadTarget,
    fileUploadRef,
    prefillMessage,
    textboxRef,
    isThreadView,
    additionalControls,
    labels,
    disableSend = false,
    ctrlSend,
    codeBlockOnCtrlEnter,
    onMessageChange,
    onEditLatestPost,
    loadPrevMessage,
    loadNextMessage,
    replyToLastPost,
    caretPosition,
    placeholder,
}: Props) => {
    const readOnlyChannel = !canPost;
    const {formatMessage} = useIntl();
    const ariaLabelMessageInput = Utils.localizeMessage(
        'accessibility.sections.centerFooter',
        'message input complimentary region',
    );
    const emojiPickerRef = useRef<HTMLButtonElement>(null);
    const editorActionsRef = useRef<HTMLDivElement>(null);
    const editorBodyRef = useRef<HTMLDivElement>(null);
    const timeout = useRef<NodeJS.Timeout>();

    const [renderScrollbar, setRenderScrollbar] = useState(false);
    const [showFormattingSpacer, setShowFormattingSpacer] = useState(shouldShowPreview);
    const [keepEditorInFocus, setKeepEditorInFocus] = useState(false);

    const isNonFormattedPaste = useRef(false);
    const timeoutId = useRef<number>();

    const dispatch = useDispatch();

    const input = textboxRef.current?.getInputBox();

    const handleHeightChange = useCallback((height: number, maxHeight: number) => {
        setRenderScrollbar(height > maxHeight);
    }, []);

    const handleShowFormat = useCallback(() => {
        setShowPreview(!shouldShowPreview);
    }, [shouldShowPreview, setShowPreview]);

    const handleBlur = useCallback(() => {
        onBlur?.();
        setKeepEditorInFocus(false);
    }, [onBlur]);

    const handleFocus = useCallback(() => {
        setKeepEditorInFocus(true);
    }, []);

    const isRHS = location === Locations.RHS_COMMENT;

    let attachmentPreview = null;
    if (!readOnlyChannel && (draft.fileInfos.length > 0 || draft.uploadsInProgress.length > 0)) {
        attachmentPreview = (
            <FilePreview
                fileInfos={draft.fileInfos}
                onRemove={removePreview}
                uploadsInProgress={draft.uploadsInProgress}
                uploadsProgressPercent={uploadsProgressPercent}
            />
        );
    }

    const getFileCount = () => {
        return draft.fileInfos.length + draft.uploadsInProgress.length;
    };

    let postType = 'post';
    if (postId) {
        postType = isThreadView ? 'thread' : 'comment';
    }

    const fileUploadJSX = readOnlyChannel ? null : (
        <FileUpload
            ref={fileUploadRef}
            fileCount={getFileCount()}
            getTarget={getFileUploadTarget}
            onFileUploadChange={handleFileUploadChange}
            onUploadStart={handleUploadStart}
            onFileUpload={handleFileUploadComplete}
            onUploadError={handleUploadError}
            onUploadProgress={handleUploadProgress}
            rootId={postId}
            channelId={channelId}
            postType={postType}
        />
    );

    const getEmojiPickerRef = () => {
        return emojiPickerRef.current;
    };

    let emojiPicker = null;

    if (enableEmojiPicker && !readOnlyChannel) {
        const emojiPickerTooltip = (
            <Tooltip id='upload-tooltip'>
                <KeyboardShortcutSequence
                    shortcut={KEYBOARD_SHORTCUTS.msgShowEmojiPicker}
                    hoistDescription={true}
                    isInsideTooltip={true}
                />
            </Tooltip>
        );
        emojiPicker = (
            <>
                <EmojiPickerOverlay
                    show={showEmojiPicker}
                    target={getEmojiPickerRef}
                    onHide={hideEmojiPicker}
                    onEmojiClick={handleEmojiClick}
                    onGifClick={handleGifClick}
                    enableGifPicker={enableGifPicker}
                    topOffset={-7}
                />
                <OverlayTrigger
                    placement='top'
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    trigger={Constants.OVERLAY_DEFAULT_TRIGGER}
                    overlay={emojiPickerTooltip}
                >
                    <IconContainer
                        id={'emojiPickerButton'}
                        ref={emojiPickerRef}
                        onClick={toggleEmojiPicker}
                        type='button'
                        aria-label={formatMessage({id: 'emoji_picker.emojiPicker.button.ariaLabel', defaultMessage: 'select an emoji'})}
                        disabled={shouldShowPreview}
                        className={classNames({active: showEmojiPicker})}
                    >
                        <EmoticonHappyOutlineIcon
                            color={'currentColor'}
                            size={18}
                        />
                    </IconContainer>
                </OverlayTrigger>
            </>
        );
    }

    const disableSendButton = Boolean(readOnlyChannel || (!message.trim().length && !draft.fileInfos.length)) || disableSend;
    const sendButton = readOnlyChannel ? null : (
        <SendButton
            disabled={disableSendButton}
            handleSubmit={handleSubmit}
        />
    );

    const showFormatJSX = disableSendButton ? null : (
        <ShowFormat
            onClick={handleShowFormat}
            active={shouldShowPreview}
        />
    );

    let createMessage;
    if (placeholder) {
        createMessage = placeholder;
    } else if (currentChannel && !readOnlyChannel) {
        createMessage = formatMessage(
            {
                id: 'create_post.write',
                defaultMessage: 'Write to {channelDisplayName}',
            },
            {channelDisplayName: currentChannel.display_name},
        );
    } else if (readOnlyChannel) {
        createMessage = Utils.localizeMessage(
            'create_post.read_only',
            'This channel is read-only. Only members with permission can post here.',
        );
    } else {
        createMessage = Utils.localizeMessage('create_comment.addComment', 'Reply to this thread...');
    }

    const messageValue = readOnlyChannel ? '' : message;

    /**
     * by getting the value directly from the textbox we eliminate all unnecessary
     * re-renders for the FormattingBar component. The previous method of always passing
     * down the current message value that came from the parents state was not optimal,
     * although still working as expected
     */
    const getCurrentValue = useCallback(() => textboxRef.current?.getInputBox().value, [textboxRef]);
    const getCurrentSelection = useCallback(() => {
        const input = textboxRef.current?.getInputBox();

        return {
            start: input.selectionStart,
            end: input.selectionEnd,
        };
    }, [textboxRef]);

    let textboxId = 'textbox';

    switch (location) {
    case Locations.CENTER:
        textboxId = 'post_textbox';
        break;
    case Locations.RHS_COMMENT:
        textboxId = 'reply_textbox';
        break;
    case Locations.MODAL:
        textboxId = 'modal_textbox';
        break;
    }

    const showFormattingBar = !isFormattingBarHidden && !readOnlyChannel;

    const handleWidthChange = useCallback((width: number) => {
        if (!editorBodyRef.current || !editorActionsRef.current || !input) {
            return;
        }

        const maxWidth = editorBodyRef.current.offsetWidth - editorActionsRef.current.offsetWidth;

        if (!message) {
            // if we do not have a message we can just render the default state
            setShowFormattingSpacer(false);
            return;
        }

        if (width >= maxWidth) {
            setShowFormattingSpacer(true);
        } else {
            setShowFormattingSpacer(false);
        }
    }, [message, input]);

    const handleKeyDown = (e: React.KeyboardEvent<TextboxElement>) => {
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

        // listen for line break key combo and insert new line character
        if (Utils.isUnhandledLineBreakKeyCombo(e)) {
            onMessageChange(Utils.insertLineBreakFromKeyEvent(e.nativeEvent));
            return;
        }

        if (ctrlEnterKeyCombo) {
            setShowPreview(false);
            postMsgKeyPress(e);
            return;
        }

        if (Keyboard.isKeyPressed(e, KeyCodes.ESCAPE)) {
            textboxRef.current?.blur();
        }

        const upKeyOnly = !ctrlOrMetaKeyPressed && !e.altKey && !e.shiftKey && Keyboard.isKeyPressed(e, KeyCodes.UP);
        const messageIsEmpty = message.length === 0;
        const draftMessageIsEmpty = draft.message.length === 0;
        const caretIsWithinCodeBlock = caretPosition && isWithinCodeBlock(message, caretPosition);

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
            if (draftMessageIsEmpty && Keyboard.isKeyPressed(e, KeyCodes.UP)) {
                e.stopPropagation();
                e.preventDefault();
                loadPrevMessage(e);
            } else if (draftMessageIsEmpty && Keyboard.isKeyPressed(e, KeyCodes.DOWN)) {
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
            } else if (Keyboard.isKeyPressed(e, KeyCodes.P) && message.length && !UserAgent.isMac()) {
                e.stopPropagation();
                e.preventDefault();
                setShowPreview(!shouldShowPreview);
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
            if (Keyboard.isKeyPressed(e, KeyCodes.P) && message.length && UserAgent.isMac()) {
                e.stopPropagation();
                e.preventDefault();
                setShowPreview(!shouldShowPreview);
            } else if (Keyboard.isKeyPressed(e, KeyCodes.E)) {
                e.stopPropagation();
                e.preventDefault();
                toggleEmojiPicker();
            }
        }

        if (isRHS) {
            const lastMessageReactionKeyCombo = ctrlShiftCombo && Keyboard.isKeyPressed(e, KeyCodes.BACK_SLASH);
            if (lastMessageReactionKeyCombo) {
                e.stopPropagation();
                e.preventDefault();
                dispatch(emitShortcutReactToLastPostFrom(Locations.RHS_ROOT));
            }
        } else {
            const shiftUpKeyCombo = !ctrlOrMetaKeyPressed && !e.altKey && e.shiftKey && Keyboard.isKeyPressed(e, KeyCodes.UP);
            if (shiftUpKeyCombo && messageIsEmpty) {
                replyToLastPost?.(e);
            }
        }
    };

    useEffect(() => {
        function onPaste(event: ClipboardEvent) {
            pasteHandler(event, location, message, isNonFormattedPaste.current, caretPosition);
        }

        document.addEventListener('paste', onPaste);
        return () => {
            document.removeEventListener('paste', onPaste);
        };
    }, [location, message, caretPosition]);

    useEffect(() => {
        if (!message) {
            handleWidthChange(0);
        }
    }, [handleWidthChange, message]);

    useEffect(() => {
        return () => timeout.current && clearTimeout(timeout.current);
    }, []);

    const wasNotifiedOfLogIn = LocalStorageStore.getWasNotifiedOfLogIn();

    const ariaLabel = useMemo(() => {
        let label;
        if (!wasNotifiedOfLogIn) {
            label = Utils.localizeMessage(
                'channelView.login.successfull',
                'Login Successful',
            );

            // set timeout to make sure aria-label is read by a screen reader,
            // and then set the flag to "true" to make sure it's not read again until a user logs back in
            timeout.current = setTimeout(() => {
                LocalStorageStore.setWasNotifiedOfLogIn(true);
            }, 3000);
        }
        return label ? `${label} ${ariaLabelMessageInput}` : ariaLabelMessageInput;
    }, [ariaLabelMessageInput, wasNotifiedOfLogIn]);

    const formattingBar = (
        <AutoHeightSwitcher
            showSlot={showFormattingBar ? 1 : 2}
            slot1={(
                <FormattingBar
                    applyMarkdown={applyMarkdown}
                    getCurrentMessage={getCurrentValue}
                    getCurrentSelection={getCurrentSelection}
                    disableControls={shouldShowPreview}
                    additionalControls={additionalControls}
                    location={location}
                />
            )}
            slot2={null}
            shouldScrollIntoView={keepEditorInFocus}
        />
    );

    return (
        <>
            <div
                className={classNames('AdvancedTextEditor', {
                    'AdvancedTextEditor__attachment-disabled': !canUploadFiles,
                    scroll: renderScrollbar,
                    'formatting-bar': showFormattingBar,
                })}
            >
                {!wasNotifiedOfLogIn && (
                    <div
                        aria-live='assertive'
                        className='sr-only'
                    >
                        <FormattedMessage
                            id='channelView.login.successfull'
                            defaultMessage='Login Successful'
                        />
                    </div>
                )}
                <div
                    className={'AdvancedTextEditor__body'}
                    disabled={readOnlyChannel}
                >
                    <div
                        ref={editorBodyRef}
                        role='application'
                        id='advancedTextEditorCell'
                        data-a11y-sort-order='2'
                        aria-label={ariaLabel}
                        tabIndex={-1}
                        className='AdvancedTextEditor__cell a11y__region'
                    >
                        {labels}
                        <Textbox
                            hasLabels={Boolean(labels)}
                            suggestionList={location === Locations.RHS_COMMENT ? RhsSuggestionList : SuggestionList}
                            onChange={handleChange}
                            onKeyPress={postMsgKeyPress}
                            onKeyDown={handleKeyDown}
                            onMouseUp={handleMouseUpKeyUp}
                            onKeyUp={handleMouseUpKeyUp}
                            onComposition={emitTypingEvent}
                            onHeightChange={handleHeightChange}
                            handlePostError={handlePostError}
                            value={messageValue}
                            onBlur={handleBlur}
                            onFocus={handleFocus}
                            emojiEnabled={enableEmojiPicker}
                            createMessage={createMessage}
                            channelId={channelId}
                            id={textboxId}
                            ref={textboxRef!}
                            disabled={readOnlyChannel}
                            characterLimit={maxPostSize}
                            preview={shouldShowPreview}
                            badConnection={badConnection}
                            useChannelMentions={useChannelMentions}
                            rootId={postId}
                            onWidthChange={handleWidthChange}
                        />
                        {attachmentPreview}
                        {!readOnlyChannel && (showFormattingBar || shouldShowPreview) && (
                            <TexteditorActions
                                placement='top'
                                isScrollbarRendered={renderScrollbar}
                            >
                                {showFormatJSX}
                            </TexteditorActions>
                        )}
                        {showFormattingSpacer || shouldShowPreview || attachmentPreview || isRHS ? (
                            <FormattingBarSpacer>
                                {formattingBar}
                            </FormattingBarSpacer>
                        ) : formattingBar}
                        {!readOnlyChannel && (
                            <TexteditorActions
                                ref={editorActionsRef}
                                placement='bottom'
                            >
                                <ToggleFormattingBar
                                    onClick={toggleAdvanceTextEditor}
                                    active={showFormattingBar}
                                    disabled={shouldShowPreview}
                                />
                                <Separator/>
                                {fileUploadJSX}
                                {emojiPicker}
                                {sendButton}
                            </TexteditorActions>
                        )}
                    </div>
                    {showSendTutorialTip && currentChannel && prefillMessage && (
                        <SendMessageTour
                            prefillMessage={prefillMessage}
                            currentChannel={currentChannel}
                            currentUserId={currentUserId}
                            currentChannelTeammateUsername={currentChannelTeammateUsername}
                        />
                    )}
                </div>
            </div>
            <div
                id='postCreateFooter'
                role='form'
                className={classNames('AdvancedTextEditor__footer', {'AdvancedTextEditor__footer--has-error': postError || serverError})}
            >
                {postError && (
                    <label className={classNames('post-error', {errorClass})}>
                        {postError}
                    </label>
                )}
                {serverError && (
                    <MessageSubmitError
                        error={serverError}
                        submittedMessage={serverError.submittedMessage}
                        handleSubmit={handleSubmit}
                    />
                )}
                <MsgTyping
                    channelId={channelId}
                    postId={postId}
                />
            </div>
        </>
    );
};

export default AdvanceTextEditor;
