import React from 'react'
import {Channel} from '@mattermost/types/channels';
import {TextboxClass, TextboxElement} from 'components/textbox';
import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';
import FileLimitStickyBanner from 'components/file_limit_sticky_banner';
import {FilePreviewInfo} from 'components/file_preview/file_preview';
import {ServerError} from '@mattermost/types/errors';
import { PostDraft } from 'types/store/draft';
import {
    ApplyMarkdownOptions,
} from 'utils/markdown/apply_markdown';
import {Emoji} from '@mattermost/types/emojis';
import {FileInfo} from '@mattermost/types/files';
import {FileUpload as FileUploadClass} from 'components/file_upload/file_upload';
import {PluginComponent} from 'types/store/plugins';

type Props = {
    message: string;
    postId?: string;
    location: string;
    currentChannel?: Channel;
    channelId?: string;
    showSendTutorialTip?: boolean;
    onKeyPress: (e: React.KeyboardEvent<TextboxElement>) => void;
    isThreadView?: boolean;
    prefillMessage?: (message: string, shouldFocus?: boolean) => void;
    disableSend?: boolean;
    priorityLabel?: JSX.Element;
    priorityControls?: JSX.Element;
    textboxRef: React.RefObject<TextboxClass>;
    currentUserId: string;
    showEmojiPicker: boolean;
    uploadsProgressPercent: {
        [clientID: string]: FilePreviewInfo;
    },
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
    maxPostSize: number;
    canPost: boolean;
    applyMarkdown: (params: ApplyMarkdownOptions) => void;
    useChannelMentions: boolean;
    badConnection: boolean;
    canUploadFiles: boolean;
    enableEmojiPicker: boolean;
    enableGifPicker: boolean;
    handleBlur: () => void;
    postError?: React.ReactNode;
    handlePostError: (postError: React.ReactNode) => void;
    emitTypingEvent: () => void;
    handleMouseUpKeyUp: (e: React.KeyboardEvent<TextboxElement> | React.MouseEvent<TextboxElement, MouseEvent>) => void;
    handleKeyDown: (e: React.KeyboardEvent<TextboxElement>) => void;
    handleChange: (e: React.ChangeEvent<TextboxElement>) => void;
    toggleEmojiPicker: () => void;
    handleGifClick: (gif: string) => void;
    handleEmojiClick:  (emoji: Emoji) => void;
    hideEmojiPicker: () => void;
    toggleAdvanceTextEditor: () => void;
    handleUploadProgress: (filePreviewInfo: FilePreviewInfo) => void;
    handleUploadError: (err: string | ServerError | null, clientId?: string | undefined, channelId?: string | undefined) => void;
    handleFileUploadComplete: (fileInfos: FileInfo[], clientIds: string[], channelId: string, rootId?: string | undefined) => void;
    handleUploadStart: (clientIds: string[], channelId: string) => void;
    handleFileUploadChange: () => void;
    getFileUploadTarget: () => HTMLInputElement | null;
    fileUploadRef: React.RefObject<FileUploadClass>;
    formId?: string;
    formClass?: string;
    formRef?: React.RefObject<HTMLFormElement>;
    postEditorActions?: PluginComponent[];
    onPluginUpdateText: (message: string) => void;
}
const Foo = ({
    message,
    postId = '',
    location,
    currentChannel,
    channelId,
    showSendTutorialTip,
    onKeyPress,
    isThreadView,
    disableSend,
    priorityLabel,
    priorityControls,
    textboxRef,
    currentUserId,
    showEmojiPicker,
    uploadsProgressPercent,
    errorClass,
    serverError,
    isFormattingBarHidden,
    draft,
    handleSubmit,
    removePreview,
    setShowPreview,
    shouldShowPreview,
    maxPostSize,
    canPost,
    applyMarkdown,
    useChannelMentions,
    badConnection,
    canUploadFiles,
    enableEmojiPicker,
    enableGifPicker,
    handleBlur,
    postError,
    handlePostError,
    emitTypingEvent,
    handleMouseUpKeyUp,
    handleKeyDown,
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
    formId,
    formClass,
    formRef,
    postEditorActions,
    onPluginUpdateText,
}: Props) => {
    const textEditorChannelId = currentChannel?.id || channelId || '';
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

    return (
        <form
            id={formId}
            className={formClass}
            ref={formRef}
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
                    currentChannel={currentChannel}
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
                    postMsgKeyPress={onKeyPress}
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
                />
            </form>
    );
}

export default Foo;