// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';

import {Posts} from 'mattermost-redux/constants';
import {sortFileInfos} from 'mattermost-redux/utils/file_utils';
import {ActionResult} from 'mattermost-redux/types/actions';

import {Channel} from '@mattermost/types/channels';
import {Post, PostPriority, PostPriorityMetadata} from '@mattermost/types/posts';
import {PreferenceType} from '@mattermost/types/preferences';
import {ServerError} from '@mattermost/types/errors';
import {FileInfo} from '@mattermost/types/files';
import {Emoji} from '@mattermost/types/emojis';

import * as GlobalActions from 'actions/global_actions';
import Constants, {
    StoragePrefixes,
    Locations,
    A11yClassNames,
    Preferences,
    AdvancedTextEditor as AdvancedTextEditorConst,
} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {
    specialMentionsInText,
    shouldFocusMainTextbox,
    isErrorInvalidSlashCommand,
    splitMessageBasedOnCaretPosition,
    mentionsMinusSpecialMentionsInText,
} from 'utils/post_utils';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';

import {FileUpload as FileUploadClass} from 'components/file_upload/file_upload';
import TextboxClass from 'components/textbox/textbox';
import PostPriorityPickerOverlay from 'components/post_priority/post_priority_picker_overlay';

import {PostDraft} from 'types/store/draft';

import PriorityLabels from './priority_labels';
import UnifiedTextEditorForm from 'components/advanced_text_editor/unified_text_editor_form';
import {SubmitServerError} from 'actions/views/create_comment';

const KeyCodes = Constants.KeyCodes;

type TextboxElement = HTMLInputElement | HTMLTextAreaElement;

type Props = {

    // Data used in multiple places of the component
    currentChannel: Channel;

    //Data used for posting message
    currentUserId: string;

    //Flag used for adding a class center to Postbox based on user pref
    fullWidthTextBox?: boolean;

    // Data used for deciding if tutorial tip is to be shown
    showSendTutorialTip: boolean;

    // Data used populating message state when triggered by shortcuts
    messageInHistoryItem?: string;

    // Data used for populating message state from previous draft
    draft: PostDraft;

    // Data used for knowing if the draft came from a WS event
    isRemoteDraft: boolean;

    // Data used dispatching handleViewAction ex: edit post
    latestReplyablePostId?: string;
    locale: string;

    // Data used for calling edit of post
    currentUsersLatestPost?: Post | null;

    rhsExpanded: boolean;

    //If RHS open
    rhsOpen: boolean;

    canPost: boolean;

    //Should preview be showed
    shouldShowPreview: boolean;

    isFormattingBarHidden: boolean;

    isPostPriorityEnabled: boolean;

    actions: {

        //Set show preview for textbox
        setShowPreview: (showPreview: boolean) => void;

        // func called for navigation through messages by Up arrow
        moveHistoryIndexBack: (index: string) => Promise<void>;

        // func called for navigation through messages by Down arrow
        moveHistoryIndexForward: (index: string) => Promise<void>;

        // func called on load of component to clear drafts
        clearDraftUploads: () => void;

        // func called for setting drafts
        setDraft: (name: string, value: PostDraft | null, draftChannelId: string, save?: boolean, instant?: boolean) => void;

        // func called for editing posts
        setEditingPost: (postId?: string, refocusId?: string, title?: string, isRHS?: boolean) => void;

        // func called for opening the last replayable post in the RHS
        selectPostFromRightHandSideSearchByPostId: (postId: string) => void;

        scrollPostListToBottom: () => void;

        //Function to set or unset emoji picker for last message
        emitShortcutReactToLastPostFrom: (emittedFrom: string) => void;

        getChannelMemberCountsFromMessage: (channelId: string, message: string) => void;

        //Function used to advance the tutorial forward
        savePreferences: (userId: string, preferences: PreferenceType[]) => ActionResult;
        handleSubmit: (draft: PostDraft, preSubmit: () => void, onSubmitted: (res: ActionResult, draft: PostDraft) => void, serverError: SubmitServerError, latestPost: string | undefined) => ActionResult;
    };
}

type State = {
    message: string;
    caretPosition: number;
    showEmojiPicker: boolean;
    renderScrollbar: boolean;
    scrollbarWidth: number;
    currentChannel: Channel;
    errorClass: string | null;
    serverError: (ServerError & {submittedMessage?: string}) | null;
    postError?: React.ReactNode;
    showFormat: boolean;
    isFormattingBarHidden: boolean;
    showPostPriorityPicker: boolean;
};

class AdvancedCreatePost extends React.PureComponent<Props, State> {
    static defaultProps = {
        latestReplyablePostId: '',
    };

    private lastBlurAt = 0;
    private lastChannelSwitchAt = 0;
    private draftsForChannel: {[channelID: string]: PostDraft | null} = {};
    private lastOrientation?: string;
    private isDraftSubmitting = false;

    private textboxRef: React.RefObject<TextboxClass>;
    private fileUploadRef: React.RefObject<FileUploadClass>;

    static getDerivedStateFromProps(props: Props, state: State): Partial<State> {
        let updatedState: Partial<State> = {
            currentChannel: props.currentChannel,
        };
        if (
            props.currentChannel.id !== state.currentChannel.id ||
            (props.isRemoteDraft && props.draft.message !== state.message)
        ) {
            updatedState = {
                ...updatedState,
                message: props.draft.message,
                serverError: null,
            };
        }
        return updatedState;
    }

    constructor(props: Props) {
        super(props);
        this.state = {
            message: props.draft.message,
            caretPosition: props.draft.message.length,
            showEmojiPicker: false,
            renderScrollbar: false,
            scrollbarWidth: 0,
            currentChannel: props.currentChannel,
            errorClass: null,
            serverError: null,
            showFormat: false,
            isFormattingBarHidden: props.isFormattingBarHidden,
            showPostPriorityPicker: false,
        };

        this.textboxRef = React.createRef<TextboxClass>();
        this.fileUploadRef = React.createRef<FileUploadClass>();
    }

    componentDidMount() {
        const {actions} = this.props;
        this.onOrientationChange();
        actions.setShowPreview(false);
        actions.clearDraftUploads();
        this.focusTextbox();
        document.addEventListener('keydown', this.documentKeyHandler);
        this.setOrientationListeners();
        this.getChannelMemberCountsByGroup();
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        const {currentChannel, actions} = this.props;
        if (prevProps.currentChannel.id !== currentChannel.id) {
            this.lastChannelSwitchAt = Date.now();
            this.focusTextbox();
            this.saveDraft(prevProps);
            this.getChannelMemberCountsByGroup();
        }

        if (currentChannel.id !== prevProps.currentChannel.id) {
            actions.setShowPreview(false);
        }

        // Focus on textbox when emoji picker is closed
        if (prevState.showEmojiPicker && !this.state.showEmojiPicker) {
            this.focusTextbox();
        }

        // Focus on textbox when returned from preview mode
        if (prevProps.shouldShowPreview && !this.props.shouldShowPreview) {
            this.focusTextbox();
        }
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.documentKeyHandler);
        this.removeOrientationListeners();
        this.saveDraft();
    }

    getChannelMemberCountsByGroup = () => {
        this.props.actions.getChannelMemberCountsFromMessage(this.props.currentChannel.id, this.state.message);
    };

    saveDraft = (props = this.props) => {
        if (props.currentChannel) {
            const channelId = props.currentChannel.id;
            props.actions.setDraft(StoragePrefixes.DRAFT + channelId, this.draftsForChannel[channelId], channelId, true);
        }
    };

    setShowPreview = (newPreviewValue: boolean) => {
        this.props.actions.setShowPreview(newPreviewValue);
    };

    setOrientationListeners = () => {
        if (window.screen.orientation && 'onchange' in window.screen.orientation) {
            window.screen.orientation.addEventListener('change', this.onOrientationChange);
        } else if ('onorientationchange' in window) {
            window.addEventListener('orientationchange', this.onOrientationChange);
        }
    };

    removeOrientationListeners = () => {
        if (window.screen.orientation && 'onchange' in window.screen.orientation) {
            window.screen.orientation.removeEventListener('change', this.onOrientationChange);
        } else if ('onorientationchange' in window) {
            window.removeEventListener('orientationchange', this.onOrientationChange);
        }
    };

    onOrientationChange = () => {
        if (!UserAgent.isIosWeb()) {
            return;
        }

        const LANDSCAPE_ANGLE = 90;
        let orientation = 'portrait';
        if (window.orientation) {
            orientation = Math.abs(window.orientation as number) === LANDSCAPE_ANGLE ? 'landscape' : 'portrait';
        }

        if (window.screen.orientation) {
            orientation = window.screen.orientation.type.split('-')[0];
        }

        if (
            this.lastOrientation &&
            orientation !== this.lastOrientation &&
            (document.activeElement || {}).id === 'post_textbox'
        ) {
            this.textboxRef.current?.blur();
        }

        this.lastOrientation = orientation;
    };

    handlePostError = (postError: React.ReactNode) => {
        if (this.state.postError !== postError) {
            this.setState({postError});
        }
    };

    toggleEmojiPicker = (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e?.stopPropagation();
        this.setState({showEmojiPicker: !this.state.showEmojiPicker});
    };

    hideEmojiPicker = () => {
        this.handleEmojiClose();
    };

    handleSubmitFinished = (res: ActionResult, draft: PostDraft) => {
        const channelId = draft.channelId;
        const scrollPostListToBottom = this.props.actions.scrollPostListToBottom;
        const message = draft.message;

        if (res.error) {
            const err = res.error;
            err.submittedMessage = message;
            this.setState({
                serverError: err,
                message,
            });
            this.isDraftSubmitting = false;
            return;
        }

        this.setState({message: ''});
        this.setState({
            serverError: null,
            postError: null,
            showFormat: false,
        });

        scrollPostListToBottom();
        this.isDraftSubmitting = false;
        this.draftsForChannel[channelId] = null;
    };

    handlePreSubbmit = () => {
        const fasterThanHumanWillClick = 150;
        const forceFocus = (Date.now() - this.lastBlurAt < fasterThanHumanWillClick);
        this.focusTextbox(forceFocus);
    };

    handleSubmit = async (e: React.FormEvent) => {
        const draft = {...this.props.draft, message: this.state.message};
        const serverError = this.state.serverError;
        const latestPost = this.props.latestReplyablePostId;

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

        const res = await this.props.actions.handleSubmit(draft, this.handlePreSubbmit, this.handleSubmitFinished, serverError, latestPost);

        if (res.error || res.data.shouldClear) {
            this.handleSubmitFinished(res, draft);
        }
    };

    focusTextbox = (keepFocus = false) => {
        const postTextboxDisabled = !this.props.canPost;
        if (this.textboxRef.current && postTextboxDisabled) {
            this.textboxRef.current.blur(); // Fixes Firefox bug which causes keyboard shortcuts to be ignored (MM-22482)
            return;
        }
        if (this.textboxRef.current && (keepFocus || !UserAgent.isMobile())) {
            this.textboxRef.current.focus();
        }
    };

    emitTypingEvent = () => {
        const channelId = this.props.currentChannel.id;
        GlobalActions.emitLocalUserTypingEvent(channelId, '');
    };

    handleChange = (e: React.ChangeEvent<TextboxElement>) => {
        const message = e.target.value;

        let serverError = this.state.serverError;
        if (isErrorInvalidSlashCommand(serverError)) {
            serverError = null;
        }

        this.setState({
            message,
            serverError,
        });

        const draft = {
            ...this.props.draft,
            message,
        };

        this.handleDraftChange(draft);
    };

    handleDraftChange = (draft: PostDraft, instant = false) => {
        const channelId = this.props.currentChannel.id;
        this.props.actions.setDraft(StoragePrefixes.DRAFT + channelId, draft, channelId, false, instant);
        this.draftsForChannel[channelId] = draft;
    };

    handleFileUploadChange = () => {
        this.focusTextbox();
    };

    handleUploadStart = (clientIds: string[], channelId: string) => {
        const uploadsInProgress = [...this.props.draft.uploadsInProgress, ...clientIds];

        const draft = {
            ...this.props.draft,
            uploadsInProgress,
        };

        this.props.actions.setDraft(StoragePrefixes.DRAFT + channelId, draft, channelId);
        this.draftsForChannel[channelId] = draft;

        // this is a bit redundant with the code that sets focus when the file input is clicked,
        // but this also resets the focus after a drag and drop
        this.focusTextbox();
    };

    handleFileUploadComplete = (fileInfos: FileInfo[], clientIds: string[], channelId: string) => {
        const draft = {...this.draftsForChannel[channelId]!};

        // remove each finished file from uploads
        for (let i = 0; i < clientIds.length; i++) {
            if (draft.uploadsInProgress) {
                const index = draft.uploadsInProgress.indexOf(clientIds[i]);

                if (index !== -1) {
                    draft.uploadsInProgress = draft.uploadsInProgress.filter((item, itemIndex) => index !== itemIndex);
                }
            }
        }

        if (draft.fileInfos) {
            draft.fileInfos = sortFileInfos(draft.fileInfos.concat(fileInfos), this.props.locale);
        }

        this.handleDraftChange(draft, true);
    };

    handleUploadError = (uploadError: string | ServerError | null, clientId?: string, channelId?: string) => {
        if (clientId && channelId) {
            const draft = {...this.draftsForChannel[channelId]!};

            if (draft.uploadsInProgress) {
                const index = draft.uploadsInProgress.indexOf(clientId);

                if (index !== -1) {
                    const uploadsInProgress = draft.uploadsInProgress.filter((item, itemIndex) => index !== itemIndex);
                    const modifiedDraft = {
                        ...draft,
                        uploadsInProgress,
                    };
                    this.props.actions.setDraft(StoragePrefixes.DRAFT + channelId, modifiedDraft, channelId);
                    this.draftsForChannel[channelId] = modifiedDraft;
                }
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
        const draft = {...this.props.draft};
        const fileInfos = [...draft.fileInfos];
        const uploadsInProgress = [...draft.uploadsInProgress];
        const channelId = this.props.currentChannel.id;

        // Clear previous errors
        this.setState({serverError: null});

        // id can either be the id of an uploaded file or the client id of an in progress upload
        let index = draft.fileInfos.findIndex((info) => info.id === id);
        if (index === -1) {
            index = draft.uploadsInProgress.indexOf(id);

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

        this.props.actions.setDraft(StoragePrefixes.DRAFT + channelId, modifiedDraft, channelId, false);
        this.draftsForChannel[channelId] = modifiedDraft;

        this.handleFileUploadChange();
    };

    focusTextboxIfNecessary = (e: KeyboardEvent) => {
        // Focus should go to the RHS when it is expanded
        if (this.props.rhsExpanded) {
            return;
        }

        // Hacky fix to avoid cursor jumping textbox sometimes
        if (this.props.rhsOpen && document.activeElement?.tagName === 'BODY') {
            return;
        }

        // Bit of a hack to not steal focus from the channel switch modal if it's open
        // This is a special case as the channel switch modal does not enforce focus like
        // most modals do
        if (document.getElementsByClassName('channel-switch-modal').length) {
            return;
        }

        if (shouldFocusMainTextbox(e, document.activeElement)) {
            this.focusTextbox();
        }
    };

    documentKeyHandler = (e: KeyboardEvent) => {
        const ctrlOrMetaKeyPressed = e.ctrlKey || e.metaKey;
        const lastMessageReactionKeyCombo = ctrlOrMetaKeyPressed && e.shiftKey && Keyboard.isKeyPressed(e, KeyCodes.BACK_SLASH);
        if (lastMessageReactionKeyCombo) {
            this.reactToLastMessage(e);
            return;
        }

        this.focusTextboxIfNecessary(e);
    };

    fillMessageFromHistory() {
        const lastMessage = this.props.messageInHistoryItem;
        this.setState({
            message: lastMessage || '',
        });
    }

    handleMouseUpKeyUp = (e: React.MouseEvent | React.KeyboardEvent) => {
        this.setState({
            caretPosition: (e.target as HTMLInputElement).selectionStart || 0,
        });
    };

    editLastPost = (e: React.KeyboardEvent) => {
        e.preventDefault();

        const lastPost = this.props.currentUsersLatestPost;
        if (!lastPost) {
            return;
        }

        let type;
        if (lastPost.root_id && lastPost.root_id.length > 0) {
            type = Utils.localizeMessage('create_post.comment', Posts.MESSAGE_TYPES.COMMENT);
        } else {
            type = Utils.localizeMessage('create_post.post', Posts.MESSAGE_TYPES.POST);
        }
        if (this.textboxRef.current) {
            this.textboxRef.current.blur();
        }
        this.props.actions.setEditingPost(lastPost.id, 'post_textbox', type);
    };

    replyToLastPost = (e: React.KeyboardEvent) => {
        e.preventDefault();
        const latestReplyablePostId = this.props.latestReplyablePostId;
        const replyBox = document.getElementById('reply_textbox');
        if (replyBox) {
            replyBox.focus();
        }
        if (latestReplyablePostId) {
            this.props.actions.selectPostFromRightHandSideSearchByPostId(latestReplyablePostId);
        }
    };

    loadPrevMessage = (e: React.KeyboardEvent) => {
        e.preventDefault();
        this.props.actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST).then(() => this.fillMessageFromHistory());
    };

    loadNextMessage = (e: React.KeyboardEvent) => {
        e.preventDefault();
        this.props.actions.moveHistoryIndexForward(Posts.MESSAGE_TYPES.POST).then(() => this.fillMessageFromHistory());
    };

    reactToLastMessage = (e: KeyboardEvent) => {
        e.preventDefault();

        const {rhsExpanded, actions: {emitShortcutReactToLastPostFrom}} = this.props;
        const noModalsAreOpen = document.getElementsByClassName(A11yClassNames.MODAL).length === 0;
        const noPopupsDropdownsAreOpen = document.getElementsByClassName(A11yClassNames.POPUP).length === 0;

        // Block keyboard shortcut react to last message when :
        // - RHS is completely expanded
        // - Any dropdown/popups are open
        // - Any modals are open
        if (!rhsExpanded && noModalsAreOpen && noPopupsDropdownsAreOpen) {
            emitShortcutReactToLastPostFrom(Locations.CENTER);
        }
    };

    handleBlur = () => {
        if (!this.isDraftSubmitting) {
            this.saveDraft();
        }

        this.lastBlurAt = Date.now();
    };

    handleEmojiClose = () => {
        this.setState({showEmojiPicker: false});
    };

    setMessageAndCaretPosition = (newMessage: string, newCaretPosition: number) => {
        const textbox = this.textboxRef.current?.getInputBox();

        this.setState({
            message: newMessage,
            caretPosition: newCaretPosition,
        }, () => {
            Utils.setCaretPosition(textbox, newCaretPosition);

            const draft = {
                ...this.props.draft,
                message: this.state.message,
            };

            this.handleDraftChange(draft);
        });
    };

    prefillMessage = (message: string, shouldFocus?: boolean) => {
        this.setMessageAndCaretPosition(message, message.length);

        if (shouldFocus) {
            const inputBox = this.textboxRef.current?.getInputBox();
            if (inputBox) {
                // programmatic click needed to close the create post tip
                inputBox.click();
            }
            this.focusTextbox(true);
        }
    };

    handleEmojiClick = (emoji: Emoji) => {
        const emojiAlias = ('short_names' in emoji && emoji.short_names && emoji.short_names[0]) || emoji.name;

        if (!emojiAlias) {
            //Oops.. There went something wrong
            return;
        }

        if (this.state.message === '') {
            const newMessage = ':' + emojiAlias + ': ';
            this.setMessageAndCaretPosition(newMessage, newMessage.length);
        } else {
            const {message} = this.state;
            const {firstPiece, lastPiece} = splitMessageBasedOnCaretPosition(this.state.caretPosition, message);

            // check whether the first piece of the message is empty when cursor is placed at beginning of message and avoid adding an empty string at the beginning of the message
            const newMessage =
                firstPiece === '' ? `:${emojiAlias}: ${lastPiece}` : `${firstPiece} :${emojiAlias}: ${lastPiece}`;

            const newCaretPosition =
                firstPiece === '' ? `:${emojiAlias}: `.length : `${firstPiece} :${emojiAlias}: `.length;
            this.setMessageAndCaretPosition(newMessage, newCaretPosition);
        }

        this.handleEmojiClose();
    };

    handleGifClick = (gif: string) => {
        if (this.state.message === '') {
            this.setState({message: gif});
        } else {
            const newMessage = (/\s+$/).test(this.state.message) ? this.state.message + gif : this.state.message + ' ' + gif;
            this.setState({message: newMessage});

            const draft = {
                ...this.props.draft,
                message: newMessage,
            };

            this.handleDraftChange(draft);
        }
        this.handleEmojiClose();
    };

    toggleAdvanceTextEditor = () => {
        this.setState({
            isFormattingBarHidden:
                !this.state.isFormattingBarHidden,
        });
        this.props.actions.savePreferences(this.props.currentUserId, [{
            category: Preferences.ADVANCED_TEXT_EDITOR,
            user_id: this.props.currentUserId,
            name: AdvancedTextEditorConst.POST,
            value: String(!this.state.isFormattingBarHidden),
        }]);
    };

    handleRemovePriority = () => {
        this.handlePostPriorityApply();
    };

    handlePostPriorityApply = (settings?: PostPriorityMetadata) => {
        const updatedDraft = {
            ...this.props.draft,
        };

        if (settings?.priority || settings?.requested_ack) {
            updatedDraft.metadata = {
                priority: {
                    ...settings,
                    priority: settings!.priority || '',
                    requested_ack: settings!.requested_ack,
                },
            };
        } else {
            updatedDraft.metadata = {};
        }

        this.handleDraftChange(updatedDraft, true);
        this.focusTextbox();
    };

    handlePostPriorityHide = () => {
        this.focusTextbox(true);
    };

    hasPrioritySet = () => {
        return (
            this.props.isPostPriorityEnabled &&
            this.props.draft.metadata?.priority && (
                this.props.draft.metadata.priority.priority ||
                this.props.draft.metadata.priority.requested_ack
            )
        );
    };

    isValidPersistentNotifications = (): boolean => {
        if (!this.hasPrioritySet()) {
            return true;
        }

        const {currentChannel} = this.props;
        const {priority, persistent_notifications: persistentNotifications} = this.props.draft.metadata!.priority!;
        if (priority !== PostPriority.URGENT || !persistentNotifications) {
            return true;
        }

        if (currentChannel.type === Constants.DM_CHANNEL) {
            return true;
        }

        if (this.hasSpecialMentions()) {
            return false;
        }

        const mentions = mentionsMinusSpecialMentionsInText(this.state.message);

        return mentions.length > 0;
    };

    getSpecialMentions = (): {[key: string]: boolean} => {
        return specialMentionsInText(this.state.message);
    };

    hasSpecialMentions = (): boolean => {
        return Object.values(this.getSpecialMentions()).includes(true);
    };

    onMessageChange = (message: string, callback?: (() => void) | undefined) => {
        this.handleDraftChange({
            ...this.props.draft,
            message,
        });
        this.setState({message}, callback);
    };

    render() {
        const {draft, canPost} = this.props;

        let centerClass = '';
        if (!this.props.fullWidthTextBox) {
            centerClass = 'center';
        }

        if (!this.props.currentChannel || !this.props.currentChannel.id) {
            return null;
        }

        return (
            <UnifiedTextEditorForm
                location={Locations.CENTER}
                textboxRef={this.textboxRef}
                currentUserId={this.props.currentUserId}
                message={this.state.message}
                showEmojiPicker={this.state.showEmojiPicker}
                textEditorChannel={this.state.currentChannel}
                postId={''}
                errorClass={this.state.errorClass}
                serverError={this.state.serverError}
                isFormattingBarHidden={this.state.isFormattingBarHidden}
                draft={draft}
                showSendTutorialTip={this.props.showSendTutorialTip}
                handleSubmit={this.handleSubmit}
                removePreview={this.removePreview}
                setShowPreview={this.setShowPreview}
                shouldShowPreview={this.props.shouldShowPreview}
                canPost={canPost}
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
                prefillMessage={this.prefillMessage}
                disableSend={!this.isValidPersistentNotifications()}
                priorityLabel={this.hasPrioritySet() ? (
                    <PriorityLabels
                        canRemove={!this.props.shouldShowPreview}
                        hasError={!this.isValidPersistentNotifications()}
                        specialMentions={this.getSpecialMentions()}
                        onRemove={this.handleRemovePriority}
                        persistentNotifications={draft!.metadata!.priority?.persistent_notifications}
                        priority={draft!.metadata!.priority?.priority}
                        requestedAck={draft!.metadata!.priority?.requested_ack}
                    />
                ) : undefined}
                priorityControls={this.props.isPostPriorityEnabled ? (
                    <PostPriorityPickerOverlay
                        key='post-priority-picker-key'
                        settings={draft?.metadata?.priority}
                        onApply={this.handlePostPriorityApply}
                        onClose={this.handlePostPriorityHide}
                        disabled={this.props.shouldShowPreview}
                    />
                ) : undefined}
                formId={'create_post'}
                formClass={centerClass}
                onEditLatestPost={this.editLastPost}
                onMessageChange={this.onMessageChange}
                replyToLastPost={this.replyToLastPost}
                loadNextMessage={this.loadNextMessage}
                loadPrevMessage={this.loadPrevMessage}
                caretPosition={this.state.caretPosition}
                saveDraft={this.saveDraft}
                focusTextbox={this.focusTextbox}
                isValidPersistentNotifications={this.isValidPersistentNotifications}
                lastChannelSwitchAt={this.lastChannelSwitchAt}
            />
        );
    }
}

export default AdvancedCreatePost;
