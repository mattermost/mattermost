// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {EmoticonHappyOutlineIcon} from '@mattermost/compass-icons/components';

import AutoHeightSwitcher from 'components/common/auto_height_switcher';
import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import FilePreview from 'components/file_preview';
import FileUpload from 'components/file_upload';
import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import MessageSubmitError from 'components/message_submit_error';
import MsgTyping from 'components/msg_typing';
import OverlayTrigger from 'components/overlay_trigger';
import RhsSuggestionList from 'components/suggestion/rhs_suggestion_list';
import Textbox from 'components/textbox';
import Tooltip from 'components/tooltip';
import {SendMessageTour} from 'components/tours/onboarding_tour';

import Constants, {Locations} from 'utils/constants';
import * as Utils from 'utils/utils';

import FormattingBar from './formatting_bar';
import {FormattingBarSpacer, Separator} from './formatting_bar/formatting_bar';
import {IconContainer} from './formatting_bar/formatting_icon';
import SendButton from './send_button';
import ShowFormat from './show_formatting';
import TexteditorActions from './texteditor_actions';
import ToggleFormattingBar from './toggle_formatting_bar/toggle_formatting_bar';

import type {Channel} from '@mattermost/types/channels';
import type {Emoji} from '@mattermost/types/emojis';
import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo} from '@mattermost/types/files';
import type {FilePreviewInfo} from 'components/file_preview/file_preview';
import type {FileUpload as FileUploadClass} from 'components/file_upload/file_upload';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';
import type {CSSProperties} from 'react';
import type {PostDraft} from 'types/store/draft';
import type {ApplyMarkdownOptions} from 'utils/markdown/apply_markdown';

import './advanced_text_editor.scss';

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
    handleKeyDown: (e: React.KeyboardEvent<TextboxElement>) => void;
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
    handleKeyDown,
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

    const [scrollbarWidth, setScrollbarWidth] = useState(0);
    const [renderScrollbar, setRenderScrollbar] = useState(false);
    const [showFormattingSpacer, setShowFormattingSpacer] = useState(shouldShowPreview);
    const [keepEditorInFocus, setKeepEditorInFocus] = useState(false);

    const input = textboxRef.current?.getInputBox();

    const handleHeightChange = useCallback((height: number, maxHeight: number) => {
        setRenderScrollbar(height > maxHeight);

        window.requestAnimationFrame(() => {
            if (textboxRef.current) {
                setScrollbarWidth(Utils.scrollbarWidth(textboxRef.current.getInputBox()));
            }
        });
    }, [textboxRef]);

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
    const emojiButtonAriaLabel = formatMessage({
        id: 'emoji_picker.emojiPicker',
        defaultMessage: 'Emoji Picker',
    }).toLowerCase();

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
                        aria-label={emojiButtonAriaLabel}
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
    if (currentChannel && !readOnlyChannel) {
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

        const inputPaddingLeft = parseInt(window.getComputedStyle(input, null).paddingLeft || '0', 10);
        const inputPaddingRight = parseInt(window.getComputedStyle(input, null).paddingRight || '0', 10);
        const inputPaddingX = inputPaddingLeft + inputPaddingRight;
        const currentWidth = width + inputPaddingX;

        if (currentWidth >= maxWidth) {
            setShowFormattingSpacer(true);
        } else {
            setShowFormattingSpacer(false);
        }
    }, [message, input]);

    useEffect(() => {
        if (!message) {
            handleWidthChange(0);
        }
    }, [handleWidthChange, message]);

    useEffect(() => {
        if (!input) {
            return;
        }

        let padding = 16;
        if (showFormattingBar) {
            padding += 32;
        }
        if (renderScrollbar) {
            padding += 8;
        }

        input.style.paddingRight = `${padding}px`;
    }, [showFormattingBar, renderScrollbar, input]);

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
                })}
                style={
                    renderScrollbar && scrollbarWidth ? ({
                        '--detected-scrollbar-width': `${scrollbarWidth}px`,
                    } as CSSProperties) : undefined
                }
            >
                <div
                    id={'speak-'}
                    aria-live='assertive'
                    className='sr-only'
                >
                    <FormattedMessage
                        id='channelView.login.successfull'
                        defaultMessage='Login Successfull'
                    />
                </div>
                <div
                    className={'AdvancedTextEditor__body'}
                    disabled={readOnlyChannel}
                >
                    <div
                        ref={editorBodyRef}
                        role='application'
                        id='advancedTextEditorCell'
                        data-a11y-sort-order='2'
                        aria-label={Utils.localizeMessage(
                            'channelView.login.successfull',
                            'Login Successfull',
                        ) + ' ' + ariaLabelMessageInput}
                        tabIndex={-1}
                        className='AdvancedTextEditor__cell a11y__region'
                    >
                        {labels}
                        <Textbox
                            hasLabels={Boolean(labels)}
                            suggestionList={RhsSuggestionList}
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
                            listenForMentionKeyClick={true}
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
                        {showFormattingSpacer || shouldShowPreview || attachmentPreview ? (
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
