// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {Channel} from '@mattermost/types/channels';
import {TextboxClass, TextboxElement} from 'components/textbox';
import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';
import FileLimitStickyBanner from 'components/file_limit_sticky_banner';
import {FilePreviewInfo} from 'components/file_preview/file_preview';
import {ServerError} from '@mattermost/types/errors';
import {PostDraft} from 'types/store/draft';
import {
    applyMarkdown as applyMarkdownUtil,
    ApplyMarkdownOptions,
} from 'utils/markdown/apply_markdown';
import {Emoji} from '@mattermost/types/emojis';
import {FileInfo} from '@mattermost/types/files';
import {FileUpload as FileUploadClass} from 'components/file_upload/file_upload';
import {PluginComponent} from 'types/store/plugins';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from 'types/store';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {connectionErrorCount} from 'selectors/views/system';
import {canUploadFiles as canUploadFilesSelector} from 'utils/file_utils';
import Constants, {Locations, Preferences} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';
import * as UserAgent from 'utils/user_agent';
import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {pasteHandler} from 'utils/paste';
import {postMessageOnKeyPress} from 'utils/post_utils';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {Preferences as PreferencesRedux, Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

const KeyCodes = Constants.KeyCodes;

type Props = {
    message: string;
    postId?: string;
    location: string;
    textEditorChannel: Channel;
    showSendTutorialTip?: boolean;
    isThreadView?: boolean;
    prefillMessage?: (message: string, shouldFocus?: boolean) => void;
    disableSend?: boolean;
    priorityLabel?: JSX.Element;
    priorityControls?: JSX.Element;
    textboxRef: React.RefObject<TextboxClass>;
    currentUserId: string;
    showEmojiPicker: boolean;
    errorClass: string | null;
    serverError: (ServerError & {
        submittedMessage?: string | undefined;
    }) | null;
    isFormattingBarHidden: boolean;
    draft: PostDraft;
    handleSubmit: (e: React.FormEvent<Element>) => void;
    removePreview: (id: string) => void;
    setShowPreview: (newPreviewValue: boolean) => void;
    shouldShowPreview: boolean;
    canPost: boolean;
    handleBlur: () => void;
    postError?: React.ReactNode;
    handlePostError: (postError: React.ReactNode) => void;
    emitTypingEvent: () => void;
    handleMouseUpKeyUp: (e: React.KeyboardEvent<TextboxElement> | React.MouseEvent<TextboxElement, MouseEvent>) => void;
    handleChange: (e: React.ChangeEvent<TextboxElement>) => void;
    toggleEmojiPicker: () => void;
    handleGifClick: (gif: string) => void;
    handleEmojiClick: (emoji: Emoji) => void;
    hideEmojiPicker: () => void;
    toggleAdvanceTextEditor: () => void;
    handleUploadError: (err: string | ServerError | null, clientId?: string | undefined, channelId?: string | undefined) => void;
    handleFileUploadComplete: (fileInfos: FileInfo[], clientIds: string[], channelId: string, rootId?: string | undefined) => void;
    handleUploadStart: (clientIds: string[], channelId: string) => void;
    handleFileUploadChange: () => void;
    fileUploadRef: React.RefObject<FileUploadClass>;
    formId?: string;
    formClass?: string;
    onEditLatestPost: (e: React.KeyboardEvent) => void;
    onMessageChange: (message: string, callback?: (() => void) | undefined) => void;
    loadPrevMessage: (e: React.KeyboardEvent) => void;
    loadNextMessage: (e: React.KeyboardEvent) => void;
    replyToLastPost?: (e: React.KeyboardEvent) => void;
    caretPosition?: number;
    saveDraft: () => void;
    lastChannelSwitchAt?: number;
    focusTextbox: () => void;
    isValidPersistentNotifications?: () => boolean;
}

const UnifiedTextEditorForm = ({
    message,
    postId = '',
    location,
    textEditorChannel,
    showSendTutorialTip,
    isThreadView,
    prefillMessage,
    disableSend,
    priorityLabel,
    priorityControls,
    textboxRef,
    currentUserId,
    showEmojiPicker,
    errorClass,
    serverError,
    isFormattingBarHidden,
    draft,
    handleSubmit,
    removePreview,
    setShowPreview,
    shouldShowPreview,
    canPost,
    handleBlur,
    postError,
    handlePostError,
    emitTypingEvent,
    handleMouseUpKeyUp,
    handleChange,
    toggleEmojiPicker,
    handleGifClick,
    handleEmojiClick,
    hideEmojiPicker,
    toggleAdvanceTextEditor,
    handleUploadError,
    handleFileUploadComplete,
    handleUploadStart,
    handleFileUploadChange,
    fileUploadRef,
    formId,
    formClass,
    onEditLatestPost,
    onMessageChange,
    loadPrevMessage,
    loadNextMessage,
    replyToLastPost,
    caretPosition,
    saveDraft,
    lastChannelSwitchAt,
    focusTextbox,
    isValidPersistentNotifications = () => true,
}: Props) => {
    const [uploadsProgressPercent, setUploadsProgressPercent] = useState<{[clientID: string]: FilePreviewInfo}>({});
    const textEditorChannelId = textEditorChannel.id;

    const dispatch = useDispatch();
    const enableEmojiPicker = useSelector<GlobalState, boolean>((state) => getConfig(state).EnableEmojiPicker === 'true');
    const enableGifPicker = useSelector<GlobalState, boolean>((state) => getConfig(state).EnableGifPicker === 'true');
    const badConnection = useSelector<GlobalState, boolean>((state) => connectionErrorCount(state) > 1);
    const canUploadFiles = useSelector<GlobalState, boolean>((state) => canUploadFilesSelector(getConfig(state)));
    const maxPostSize = useSelector<GlobalState, number>((state) => parseInt(getConfig(state).MaxPostSize || '', 10) || Constants.DEFAULT_CHARACTER_LIMIT);
    const postEditorActions = useSelector<GlobalState, PluginComponent[] | undefined>((state) => state.plugins.components.PostEditorAction);
    const codeBlockOnCtrlEnter = useSelector<GlobalState, boolean>((state) => getBool(state, PreferencesRedux.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', true));
    const ctrlSend = useSelector<GlobalState, boolean>((state) => getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'));
    const useChannelMentions = useSelector<GlobalState, boolean>((state) => haveIChannelPermission(state, getCurrentTeamId(state), textEditorChannelId, Permissions.USE_CHANNEL_MENTIONS));

    const isRHS = location === Locations.RHS_COMMENT;

    // We don't use directly onMessageChange to make sure other potential arguments don't break
    // the behavior.
    const onPluginUpdateText = (message: string) => {
        onMessageChange(message);
    };

    useEffect(() => {
        function onPaste(event: ClipboardEvent) {
            pasteHandler(event, location, message, caretPosition);
        }

        document.addEventListener('paste', onPaste);
        return () => {
            document.removeEventListener('paste', onPaste);
        };
    }, [location, message, caretPosition]);

    useEffect(() => {
        function onUnload() {
            saveDraft();
        }

        window.addEventListener('beforeunload', onUnload);
        return () => {
            window.removeEventListener('beforeunload', onUnload);
        };
    }, [saveDraft]);

    const pluginItems = postEditorActions?.map((item) => {
        if (!item.component) {
            return null;
        }

        const Component = item.component as any;
        return (
            <Component
                key={item.id}
                draft={draft}
                getSelectedText={() => {
                    const input = textboxRef.current?.getInputBox();

                    return {
                        start: input.selectionStart,
                        end: input.selectionEnd,
                    };
                }}
                updateText={onPluginUpdateText}
            />
        );
    }) || [];
    const additionalControls = [priorityControls, ...pluginItems].filter(Boolean);

    const getFileUploadTarget = () => {
        return textboxRef.current?.getInputBox();
    };

    const handleUploadProgress = (filePreviewInfo: FilePreviewInfo) => {
        const newUploadsProgressPercent = {
            ...uploadsProgressPercent,
            [filePreviewInfo.clientId]: filePreviewInfo,
        };
        setUploadsProgressPercent(newUploadsProgressPercent);
    };

    const applyMarkdown = (options: ApplyMarkdownOptions) => {
        if (shouldShowPreview) {
            return;
        }

        const res = applyMarkdownUtil(options);

        onMessageChange(res.message, () => {
            const textbox = textboxRef.current?.getInputBox();
            Utils.setSelectionRange(textbox, res.selectionStart, res.selectionEnd);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<TextboxElement>) => {
        const ctrlOrMetaKeyPressed = e.ctrlKey || e.metaKey;
        const ctrlEnterKeyCombo = (ctrlSend || codeBlockOnCtrlEnter) &&
                Keyboard.isKeyPressed(e, KeyCodes.ENTER) &&
                ctrlOrMetaKeyPressed;

        const ctrlKeyCombo = Keyboard.cmdOrCtrlPressed(e) && !e.altKey && !e.shiftKey;
        const ctrlAltCombo = Keyboard.cmdOrCtrlPressed(e, true) && e.altKey;
        const shiftAltCombo = !Keyboard.cmdOrCtrlPressed(e) && e.shiftKey && e.altKey;
        const ctrlShiftCombo = Keyboard.cmdOrCtrlPressed(e, true) && e.shiftKey;

        // listen for line break key combo and insert new line character
        if (Utils.isUnhandledLineBreakKeyCombo(e)) {
            onMessageChange(Utils.insertLineBreakFromKeyEvent(e));
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

        if (ctrlKeyCombo) {
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
        } else if (ctrlAltCombo) {
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
        } else if (shiftAltCombo) {
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
        } else if (ctrlShiftCombo) {
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

    const postMsgKeyPress = (e: React.KeyboardEvent<TextboxElement>) => {
        const {allowSending, withClosedCodeBlock, ignoreKeyPress, message: correctedMessage} = postMessageOnKeyPress(
            e,
            message,
            Boolean(ctrlSend),
            Boolean(codeBlockOnCtrlEnter),
            isRHS ? 0 : Date.now(),
            lastChannelSwitchAt || 0,
            caretPosition,
        );

        if (ignoreKeyPress) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (allowSending && isValidPersistentNotifications()) {
            e.persist?.();
            textboxRef.current?.blur();

            if (withClosedCodeBlock && correctedMessage) {
                onMessageChange(correctedMessage, () => handleSubmit(e));
            } else {
                handleSubmit(e);
            }

            setTimeout(() => {
                focusTextbox();
            });
        }

        emitTypingEvent();
    };

    return (
        <form
            id={formId}
            className={formClass}
            onSubmit={handleSubmit}
        >
            {canPost && (draft.fileInfos.length > 0 || draft.uploadsInProgress.length > 0) && (
                <FileLimitStickyBanner/>
            )}
            <AdvancedTextEditor
                location={location}
                labels={priorityLabel}
                textboxRef={textboxRef}
                currentUserId={currentUserId}
                message={message}
                showEmojiPicker={showEmojiPicker}
                uploadsProgressPercent={uploadsProgressPercent}
                currentChannel={textEditorChannel}
                channelId={textEditorChannelId}
                postId={postId}
                errorClass={errorClass}
                serverError={serverError}
                isFormattingBarHidden={isFormattingBarHidden}
                draft={draft}
                handleSubmit={handleSubmit}
                removePreview={removePreview}
                setShowPreview={setShowPreview}
                shouldShowPreview={shouldShowPreview}
                maxPostSize={maxPostSize}
                canPost={canPost}
                applyMarkdown={applyMarkdown}
                useChannelMentions={useChannelMentions}
                badConnection={badConnection}
                canUploadFiles={canUploadFiles}
                enableEmojiPicker={enableEmojiPicker}
                enableGifPicker={enableGifPicker}
                handleBlur={handleBlur}
                postError={postError}
                handlePostError={handlePostError}
                emitTypingEvent={emitTypingEvent}
                handleMouseUpKeyUp={handleMouseUpKeyUp}
                handleKeyDown={handleKeyDown}
                postMsgKeyPress={postMsgKeyPress}
                handleChange={handleChange}
                toggleEmojiPicker={toggleEmojiPicker}
                handleGifClick={handleGifClick}
                handleEmojiClick={handleEmojiClick}
                hideEmojiPicker={hideEmojiPicker}
                toggleAdvanceTextEditor={toggleAdvanceTextEditor}
                handleUploadProgress={handleUploadProgress}
                handleUploadError={handleUploadError}
                handleFileUploadComplete={handleFileUploadComplete}
                handleUploadStart={handleUploadStart}
                handleFileUploadChange={handleFileUploadChange}
                getFileUploadTarget={getFileUploadTarget}
                fileUploadRef={fileUploadRef}
                isThreadView={isThreadView}
                additionalControls={additionalControls}
                showSendTutorialTip={showSendTutorialTip}
                disableSend={disableSend}
                prefillMessage={prefillMessage}
            />
        </form>
    );
};

export default UnifiedTextEditorForm;
