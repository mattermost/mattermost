// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';

import {PreferenceType} from '@mattermost/types/preferences';
import {Channel} from '@mattermost/types/channels';
import {Emoji} from '@mattermost/types/emojis';
import {ServerError} from '@mattermost/types/errors';
import {FileInfo} from '@mattermost/types/files';

import {ActionResult} from 'mattermost-redux/types/actions';
import {sortFileInfos} from 'mattermost-redux/utils/file_utils';

import * as GlobalActions from 'actions/global_actions';

import {PostDraft} from 'types/store/draft';
import {ModalData} from 'types/actions';

import Constants, {AdvancedTextEditor as AdvancedTextEditorConst, Locations, ModalIdentifiers, Preferences} from 'utils/constants';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';
import {
    shouldFocusMainTextbox,
    isErrorInvalidSlashCommand,
    splitMessageBasedOnCaretPosition,
} from 'utils/post_utils';

import {FileUpload as FileUploadClass} from 'components/file_upload/file_upload';
import PostDeletedModal from 'components/post_deleted_modal';
import {TextboxClass, TextboxElement} from 'components/textbox';
import UnifiedTextEditorForm from 'components/advanced_text_editor/unified_text_editor_form';
import {Posts} from 'mattermost-redux/constants';
import {SubmitServerError} from 'actions/views/create_comment';

type Props = {

    // The channel for which this comment is a part of
    channelId: string;

    // The id of the current user
    currentUserId: string;

    // The id of the parent post
    rootId: string;

    // The root message is deleted
    rootDeleted: boolean;

    // The current history message selected
    messageInHistory?: string;

    // The current draft of the comment
    draft: PostDraft;

    // Data used for knowing if the draft came from a WS event
    isRemoteDraft: boolean;

    // Determines if the submit button should be rendered
    enableAddButton?: boolean;

    // The id of the latest post in this channel
    latestPostId?: string;

    // The current user locale
    locale: string;

    // Error id, if the post creation fails
    createPostErrorId?: string;

    // Determines if the current user can edit the post
    canPost: boolean;

    // Called to clear file uploads in progress
    clearCommentDraftUploads: () => void;

    // Called when comment draft needs to be updated
    onUpdateCommentDraft: (draft: PostDraft, save?: boolean, instant?: boolean) => void;

    // Called when resetting comment message history index
    onResetHistoryIndex: () => void;

    // Called when navigating back through comment message history
    moveHistoryIndexBack: (index: string) => Promise<void>;

    // Called when navigating forward through comment message history
    moveHistoryIndexForward: (index: string) => Promise<void>;

    // Called to initiate editing the user's latest post
    onEditLatestPost: () => ActionResult;

    // Reset state of createPost request
    resetCreatePostRequest: () => void;

    // Determines if the RHS is in expanded state
    rhsExpanded: boolean;

    // The last time, if any, the selected post changed. Will be 0 if no post is selected.
    selectedPostFocussedAt: number;

    // Set show preview for textbox
    setShowPreview: (showPreview: boolean) => void;

    // Determines if the preview should be shown
    shouldShowPreview: boolean;

    // Called when parent component should be scrolled to bottom
    scrollToBottom?: () => void;

    // Group member mention
    getChannelMemberCountsFromMessage: (channelID: string, message: string) => void;

    focusOnMount?: boolean;
    isThreadView?: boolean;
    openModal: <P>(modalData: ModalData<P>) => void;
    savePreferences: (userId: string, preferences: PreferenceType[]) => ActionResult;
    isFormattingBarHidden: boolean;
    channel: Channel;
    handleSubmit: (draft: PostDraft, preSubmit: () => void, onSubmitted: (res: ActionResult, draft: PostDraft) => void, serverError: SubmitServerError, latestPost: string | undefined) => ActionResult;
}

type State = {
    draft: PostDraft;
    showEmojiPicker: boolean;
    renderScrollbar: boolean;
    scrollbarWidth: number;
    rootId?: string;
    messageInHistory?: string;
    createPostErrorId?: string;
    caretPosition?: number;
    postError?: React.ReactNode;
    errorClass: string | null;
    serverError: (ServerError & {submittedMessage?: string}) | null;
    showFormat: boolean;
    isFormattingBarHidden: boolean;
};

class AdvancedCreateComment extends React.PureComponent<Props, State> {
    private lastBlurAt = 0;
    private draftsForPost: {[postID: string]: PostDraft | null} = {};
    private doInitialScrollToBottom = false;

    private isDraftSubmitting = false;
    private isDraftEdited = false;

    private readonly textboxRef: React.RefObject<TextboxClass>;
    private readonly fileUploadRef: React.RefObject<FileUploadClass>;

    static defaultProps = {
        focusOnMount: true,
    };

    static getDerivedStateFromProps(props: Props, state: State) {
        let updatedState: Partial<State> = {
            createPostErrorId: props.createPostErrorId,
            rootId: props.rootId,
            messageInHistory: props.messageInHistory,
        };

        const rootChanged = props.rootId !== state.rootId || props.draft.rootId !== state.draft?.rootId;
        const messageInHistoryChanged = props.messageInHistory !== state.messageInHistory;
        if (rootChanged || messageInHistoryChanged || (props.isRemoteDraft && props.draft.message !== state.draft?.message)) {
            updatedState = {
                ...updatedState,
                draft: {
                    ...props.draft,
                    uploadsInProgress: rootChanged ? [] : props.draft.uploadsInProgress,
                },
            };
        }

        return updatedState;
    }

    constructor(props: Props) {
        super(props);

        this.state = {
            showEmojiPicker: false,
            renderScrollbar: false,
            scrollbarWidth: 0,
            errorClass: null,
            serverError: null,
            showFormat: false,
            isFormattingBarHidden: props.isFormattingBarHidden,
            caretPosition: props.draft.message.length,
            draft: {...props.draft, uploadsInProgress: []},
        };

        this.textboxRef = React.createRef();
        this.fileUploadRef = React.createRef();
    }

    fillMessageFromHistory() {
        const lastMessage = this.props.messageInHistory;
        this.setState((prev) => ({
            draft: {
                ...prev.draft,
                message: lastMessage || '',
            },
        }));
    }

    loadPrevMessage = (e: React.KeyboardEvent) => {
        e.preventDefault();
        this.props.moveHistoryIndexBack(Posts.MESSAGE_TYPES.COMMENT).then(() => this.fillMessageFromHistory());
    };

    loadNextMessage = (e: React.KeyboardEvent) => {
        e.preventDefault();
        this.props.moveHistoryIndexForward(Posts.MESSAGE_TYPES.COMMENT).then(() => this.fillMessageFromHistory());
    };

    componentDidMount() {
        const {clearCommentDraftUploads, onResetHistoryIndex, setShowPreview, draft} = this.props;
        clearCommentDraftUploads();
        onResetHistoryIndex();
        setShowPreview(false);

        if (this.props.focusOnMount) {
            this.focusTextbox();
        }

        document.addEventListener('keydown', this.focusTextboxIfNecessary);
        this.getChannelMemberCountsByGroup();

        // When draft.message is not empty, set doInitialScrollToBottom to true so that
        // on next component update, the actual this.scrollToBottom() will be called.
        // This is made so that the this.scrollToBottom() will be called only once.
        if (draft.message !== '') {
            this.doInitialScrollToBottom = true;
        }
    }

    componentWillUnmount() {
        this.props.resetCreatePostRequest?.();
        document.removeEventListener('keydown', this.focusTextboxIfNecessary);
        this.saveDraftOnUnmount();
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (prevState.draft!.uploadsInProgress.length < this.state.draft!.uploadsInProgress.length && this.props.scrollToBottom) {
            this.props.scrollToBottom();
        }

        // Focus on textbox when emoji picker is closed
        if (prevState.showEmojiPicker && !this.state.showEmojiPicker) {
            this.focusTextbox();
        }

        // Focus on textbox when returned from preview mode
        if (prevProps.shouldShowPreview && !this.props.shouldShowPreview) {
            this.focusTextbox();
        }

        if (prevProps.rootId !== this.props.rootId || prevProps.selectedPostFocussedAt !== this.props.selectedPostFocussedAt) {
            this.getChannelMemberCountsByGroup();
            this.focusTextbox();
        }

        if (this.doInitialScrollToBottom) {
            if (this.props.scrollToBottom) {
                this.props.scrollToBottom();
            }
            this.doInitialScrollToBottom = false;
        }

        if (this.props.createPostErrorId === 'api.post.create_post.root_id.app_error' && this.props.createPostErrorId !== prevProps.createPostErrorId) {
            this.showPostDeletedModal();
        }
    }

    getChannelMemberCountsByGroup = () => {
        this.props.getChannelMemberCountsFromMessage(this.props.channelId, this.props.draft.message);
    };

    saveDraftOnUnmount = () => {
        if (!this.isDraftEdited || this.props.rootDeleted) {
            return;
        }

        this.props.onUpdateCommentDraft(this.state.draft, true);
    };

    saveDraft = () => {
        this.props.onUpdateCommentDraft(this.state.draft, true);
    };

    setShowPreview = (newPreviewValue: boolean) => {
        this.props.setShowPreview(newPreviewValue);
    };

    focusTextboxIfNecessary = (e: KeyboardEvent) => {
        // Should only focus if RHS is expanded or if thread view
        if (!this.props.isThreadView && !this.props.rhsExpanded) {
            return;
        }

        // A bit of a hack to not steal focus from the channel switch modal if it's open
        // This is a special case as the channel switch modal does not enforce focus like
        // most modals do
        if (document.getElementsByClassName('channel-switch-modal').length) {
            return;
        }

        if (shouldFocusMainTextbox(e, document.activeElement)) {
            this.focusTextbox();
            this.toggleAdvanceTextEditor();
        }
    };

    setCaretPosition = (newCaretPosition: number) => {
        const textbox = this.textboxRef.current && this.textboxRef.current.getInputBox();

        this.setState({
            caretPosition: newCaretPosition,
        }, () => {
            Utils.setCaretPosition(textbox, newCaretPosition);
        });
    };

    toggleEmojiPicker = (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e?.stopPropagation();
        const showEmojiPicker = !this.state.showEmojiPicker;
        this.setState({showEmojiPicker});
    };

    hideEmojiPicker = () => {
        this.setState({showEmojiPicker: false});
    };

    handleEmojiClick = (emoji: Emoji) => {
        const emojiAlias = ('short_name' in emoji && emoji.short_name) || emoji.name;

        if (!emojiAlias) {
            //Oops... There went something wrong
            return;
        }

        const draft = this.state.draft;

        let newMessage: string;
        if (draft.message === '') {
            newMessage = `:${emojiAlias}: `;
            this.setCaretPosition(newMessage.length);
        } else {
            const {message} = draft;
            const {firstPiece, lastPiece} = splitMessageBasedOnCaretPosition(this.state.caretPosition || 0, message);

            // check whether the first piece of the message is empty when cursor is placed at beginning of message and avoid adding an empty string at the beginning of the message
            newMessage = firstPiece === '' ? `:${emojiAlias}: ${lastPiece} ` : `${firstPiece} :${emojiAlias}: ${lastPiece} `;

            const newCaretPosition = firstPiece === '' ? `:${emojiAlias}: `.length : `${firstPiece} :${emojiAlias}: `.length;
            this.setCaretPosition(newCaretPosition);
        }

        const modifiedDraft = {
            ...draft,
            message: newMessage,
        };

        this.handleDraftChange(modifiedDraft);

        this.setState({
            showEmojiPicker: false,
            draft: modifiedDraft,
        });
    };

    handleGifClick = (gif: string) => {
        const draft = this.state.draft;

        let newMessage: string;
        if (draft.message === '') {
            newMessage = gif;
        } else if ((/\s+$/).test(draft.message)) {
            // Check whether there is already a blank at the end of the current message
            newMessage = `${draft.message}${gif} `;
        } else {
            newMessage = `${draft.message} ${gif} `;
        }

        const modifiedDraft = {
            ...draft,
            message: newMessage,
        };

        this.handleDraftChange(modifiedDraft);

        this.setState({
            showEmojiPicker: false,
            draft: modifiedDraft,
        });

        this.focusTextbox();
    };

    handleSubmitFinished = (res: ActionResult, draft: PostDraft) => {
        const scrollPostListToBottom = this.props.scrollToBottom;
        const message = draft.message;

        if (res.error) {
            const err = res.error;
            err.submittedMessage = message;
            this.setState({
                serverError: err,
                draft,
            });
            this.isDraftSubmitting = false;
            return;
        }

        this.setState({draft: this.props.draft});
        this.setState({
            serverError: null,
            postError: null,
            showFormat: false,
        });

        scrollPostListToBottom?.();
        this.isDraftSubmitting = false;
        this.draftsForPost[draft.rootId] = null;
    };

    handlePreSubbmit = () => {
        const fasterThanHumanWillClick = 150;
        const forceFocus = (Date.now() - this.lastBlurAt < fasterThanHumanWillClick);
        this.focusTextbox(forceFocus);
    };

    handleSubmit = async (e: React.FormEvent) => {
        const draft = this.state.draft;
        const serverError = this.state.serverError;
        const latestPost = this.props.latestPostId;

        e.preventDefault();
        this.setShowPreview(false);
        this.isDraftSubmitting = true;

        if (this.state.postError) {
            this.setState({errorClass: 'animation--highlight'});
            setTimeout(() => {
                this.setState({errorClass: null});
            }, Constants.ANIMATION_TIMEOUT);
            this.isDraftSubmitting = false;
            return;
        }

        if (this.props.rootDeleted) {
            this.showPostDeletedModal();
            this.isDraftSubmitting = false;
            return;
        }

        const res = await this.props.handleSubmit(draft, this.handlePreSubbmit, this.handleSubmitFinished, serverError, latestPost);

        if (res.error || res.data.shouldClear) {
            this.handleSubmitFinished(res, draft);
        }
    };

    handlePostError = (postError: React.ReactNode) => {
        this.setState({postError});
    };

    emitTypingEvent = () => {
        const {channelId, rootId} = this.props;
        GlobalActions.emitLocalUserTypingEvent(channelId, rootId);
    };

    handleChange = (e: React.ChangeEvent<TextboxElement>) => {
        const message = e.target.value;

        let serverError = this.state.serverError;
        if (isErrorInvalidSlashCommand(serverError)) {
            serverError = null;
        }

        const draft = this.state.draft;
        const updatedDraft = {...draft, message};

        this.handleDraftChange(updatedDraft);

        this.setState({draft: updatedDraft, serverError}, () => {
            if (this.props.scrollToBottom) {
                this.props.scrollToBottom();
            }
        });
        this.draftsForPost[this.props.rootId] = updatedDraft;
    };

    handleDraftChange = (draft: PostDraft, save = false, instant = false) => {
        this.isDraftEdited = true;

        this.props.onUpdateCommentDraft(draft, save, instant);
        this.draftsForPost[draft.rootId] = draft;
    };

    handleMouseUpKeyUp = (e: React.MouseEvent | React.KeyboardEvent) => {
        this.setState({
            caretPosition: (e.target as TextboxElement).selectionStart || 0,
        });
    };

    handleEditLatestPost = () => {
        const {data: canEditNow} = this.props.onEditLatestPost();
        if (!canEditNow) {
            this.focusTextbox(true);
        }
    };

    handleFileUploadChange = () => {
        this.isDraftEdited = true;
        this.focusTextbox();
    };

    handleUploadStart = (clientIds: string[]) => {
        const draft = this.state.draft!;
        const uploadsInProgress = [...draft.uploadsInProgress, ...clientIds];

        const modifiedDraft = {
            ...draft,
            uploadsInProgress,
        };
        this.props.onUpdateCommentDraft(modifiedDraft);
        this.setState({draft: modifiedDraft});
        this.draftsForPost[this.props.rootId] = modifiedDraft;

        // this is a bit redundant with the code that sets focus when the file input is clicked,
        // but this also resets the focus after a drag and drop
        this.focusTextbox();
    };

    handleFileUploadComplete = (fileInfos: FileInfo[], clientIds: string[], _: string, rootId?: string) => {
        const draft = {...this.draftsForPost[rootId!]!};

        // remove each finished file from uploads
        for (let i = 0; i < clientIds.length; i++) {
            if (draft.uploadsInProgress) {
                const index = draft.uploadsInProgress.indexOf(clientIds[i]);

                if (index !== -1) {
                    draft.uploadsInProgress.splice(index, 1);
                }
            }
        }

        if (draft.fileInfos) {
            draft.fileInfos = sortFileInfos(draft.fileInfos.concat(fileInfos), this.props.locale);
        }

        this.handleDraftChange(draft, true, true);
        if (this.props.rootId === rootId) {
            this.setState({draft});
        }
    };

    handleUploadError = (uploadError: string | ServerError | null, clientId?: string, _?: string, rootId = '') => {
        if (clientId) {
            const draft = {...this.draftsForPost[rootId]!};
            const uploadsInProgress = [...draft.uploadsInProgress];

            const index = uploadsInProgress.indexOf(clientId as string);
            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
            }

            const modifiedDraft = {
                ...draft,
                uploadsInProgress,
            };
            this.props.onUpdateCommentDraft(modifiedDraft, true);
            this.draftsForPost[rootId] = modifiedDraft;
            if (this.props.rootId === rootId) {
                this.setState({draft: modifiedDraft});
            }
        }

        if (typeof uploadError === 'string') {
            if (uploadError.length !== 0) {
                this.setState({serverError: new Error(uploadError)});
            }
        } else {
            this.setState({serverError: uploadError});
        }
    };

    removePreview = (id: string) => {
        const draft = this.state.draft!;
        const fileInfos = [...draft.fileInfos];
        const uploadsInProgress = [...draft.uploadsInProgress];

        // Clear previous errors
        this.handleUploadError(null);

        // id can either be the id of an uploaded file or the client id of an in progress upload
        let index = fileInfos.findIndex((info) => info.id === id);
        if (index === -1) {
            index = uploadsInProgress.indexOf(id);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);

                if (this.fileUploadRef.current) {
                    this.fileUploadRef.current.cancelUpload(id);
                }
            }
        } else {
            fileInfos.splice(index, 1);
        }

        const modifiedDraft = {
            ...draft,
            fileInfos,
            uploadsInProgress,
        };

        this.props.onUpdateCommentDraft(modifiedDraft);
        this.setState({draft: modifiedDraft});
        this.draftsForPost[this.props.rootId] = modifiedDraft;

        this.handleFileUploadChange();
    };

    toggleAdvanceTextEditor = () => {
        this.setState({
            isFormattingBarHidden:
                !this.state.isFormattingBarHidden,
        });
        this.props.savePreferences(this.props.currentUserId, [{
            category: Preferences.ADVANCED_TEXT_EDITOR,
            user_id: this.props.currentUserId,
            name: AdvancedTextEditorConst.COMMENT,
            value: String(!this.state.isFormattingBarHidden),
        }]);
    };

    focusTextbox = (keepFocus = false) => {
        if (this.textboxRef.current && (keepFocus || !UserAgent.isMobile())) {
            this.textboxRef.current.focus();
        }
    };

    showPostDeletedModal = () => {
        this.props.openModal({
            modalId: ModalIdentifiers.POST_DELETED_MODAL,
            dialogType: PostDeletedModal,
        });
    };

    handleBlur = () => {
        if (!this.isDraftSubmitting) {
            this.saveDraft();
        }
        this.lastBlurAt = Date.now();
    };

    onMessageChange = (message: string, callback?: (() => void) | undefined) => {
        const draft = this.state.draft;
        const modifiedDraft = {
            ...draft,
            message,
        };
        this.handleDraftChange(modifiedDraft);
        this.setState({
            draft: modifiedDraft,
        }, callback);
    };

    render() {
        const draft = this.state.draft!;

        return (
            <UnifiedTextEditorForm
                location={Locations.RHS_COMMENT}
                textboxRef={this.textboxRef}
                currentUserId={this.props.currentUserId}
                message={draft.message}
                showEmojiPicker={this.state.showEmojiPicker}
                postId={this.props.rootId}
                errorClass={this.state.errorClass}
                serverError={this.state.serverError}
                isFormattingBarHidden={this.state.isFormattingBarHidden}
                draft={this.props.draft}
                handleSubmit={this.handleSubmit}
                removePreview={this.removePreview}
                setShowPreview={this.setShowPreview}
                shouldShowPreview={this.props.shouldShowPreview}
                canPost={this.props.canPost}
                handleBlur={this.handleBlur}
                postError={this.state.postError}
                handlePostError={this.handlePostError}
                emitTypingEvent={this.emitTypingEvent}
                handleMouseUpKeyUp={this.handleMouseUpKeyUp}
                handleChange={this.handleChange}
                toggleEmojiPicker={this.toggleEmojiPicker}
                handleGifClick={this.handleGifClick}
                handleEmojiClick={this.handleEmojiClick}
                hideEmojiPicker={this.hideEmojiPicker}
                toggleAdvanceTextEditor={this.toggleAdvanceTextEditor}
                handleUploadError={this.handleUploadError}
                handleFileUploadComplete={this.handleFileUploadComplete}
                handleUploadStart={this.handleUploadStart}
                handleFileUploadChange={this.handleFileUploadChange}
                fileUploadRef={this.fileUploadRef}
                isThreadView={this.props.isThreadView}
                onEditLatestPost={this.handleEditLatestPost}
                onMessageChange={this.onMessageChange}
                loadNextMessage={this.loadNextMessage}
                loadPrevMessage={this.loadPrevMessage}
                caretPosition={this.state.caretPosition}
                saveDraft={this.saveDraft}
                focusTextbox={this.focusTextbox}
                textEditorChannel={this.props.channel}
            />
        );
    }
}

export default AdvancedCreateComment;
