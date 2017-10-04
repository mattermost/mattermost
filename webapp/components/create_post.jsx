// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';
import MsgTyping from './msg_typing.jsx';
import Textbox from './textbox.jsx';
import FileUpload from './file_upload.jsx';
import FilePreview from './file_preview.jsx';
import PostDeletedModal from './post_deleted_modal.jsx';
import TutorialTip from './tutorial/tutorial_tip.jsx';
import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay.jsx';
import * as EmojiPicker from 'components/emoji_picker/emoji_picker.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import {isUrlSafe} from 'utils/url.jsx';
import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
import * as ChannelActions from 'actions/channel_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import PostStore from 'stores/post_store.jsx';
import MessageHistoryStore from 'stores/message_history_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import ConfirmModal from './confirm_modal.jsx';

import Constants from 'utils/constants.jsx';
import * as FileUtils from 'utils/file_utils';

import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

const Preferences = Constants.Preferences;
const TutorialSteps = Constants.TutorialSteps;
const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

import React from 'react';
import PropTypes from 'prop-types';

export const REACTION_PATTERN = /^(\+|-):([^:\s]+):\s*$/;

export default class CreatePost extends React.Component {
    constructor(props) {
        super(props);

        this.lastTime = 0;

        this.doSubmit = this.doSubmit.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.postMsgKeyPress = this.postMsgKeyPress.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleFileUploadChange = this.handleFileUploadChange.bind(this);
        this.handleUploadStart = this.handleUploadStart.bind(this);
        this.handleFileUploadComplete = this.handleFileUploadComplete.bind(this);
        this.handleUploadError = this.handleUploadError.bind(this);
        this.removePreview = this.removePreview.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.getFileCount = this.getFileCount.bind(this);
        this.getFileUploadTarget = this.getFileUploadTarget.bind(this);
        this.getCreatePostControls = this.getCreatePostControls.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.focusTextbox = this.focusTextbox.bind(this);
        this.showPostDeletedModal = this.showPostDeletedModal.bind(this);
        this.hidePostDeletedModal = this.hidePostDeletedModal.bind(this);
        this.showShortcuts = this.showShortcuts.bind(this);
        this.handleEmojiClick = this.handleEmojiClick.bind(this);
        this.handlePostError = this.handlePostError.bind(this);
        this.hideNotifyAllModal = this.hideNotifyAllModal.bind(this);
        this.showNotifyAllModal = this.showNotifyAllModal.bind(this);
        this.handleNotifyModalCancel = this.handleNotifyModalCancel.bind(this);
        this.handleNotifyAllConfirmation = this.handleNotifyAllConfirmation.bind(this);

        PostStore.clearDraftUploads();

        const channel = ChannelStore.getCurrent();
        const channelId = channel.id;
        const draft = PostStore.getDraft(channelId);
        const stats = ChannelStore.getCurrentStats();
        const members = stats.member_count - 1;

        this.state = {
            channelId,
            channel,
            message: draft.message,
            uploadsInProgress: draft.uploadsInProgress,
            fileInfos: draft.fileInfos,
            submitting: false,
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            fullWidthTextBox: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN,
            showTutorialTip: false,
            showPostDeletedModal: false,
            enableSendButton: false,
            showEmojiPicker: false,
            showConfirmModal: false,
            totalMembers: members
        };

        this.lastBlurAt = 0;
    }

    handlePostError(postError) {
        this.setState({postError});
    }

    toggleEmojiPicker = () => {
        this.setState({showEmojiPicker: !this.state.showEmojiPicker});
    }

    hideEmojiPicker = () => {
        this.setState({showEmojiPicker: false});
    }

    doSubmit(e) {
        if (e) {
            e.preventDefault();
        }

        if (this.state.uploadsInProgress.length > 0 || this.state.submitting) {
            return;
        }

        const post = {};
        post.file_ids = [];
        post.message = this.state.message;

        if (post.message.trim().length === 0 && this.state.fileInfos.length === 0) {
            return;
        }

        if (this.state.postError) {
            this.setState({errorClass: 'animation--highlight'});
            setTimeout(() => {
                this.setState({errorClass: null});
            }, Constants.ANIMATION_TIMEOUT);
            return;
        }

        MessageHistoryStore.storeMessageInHistory(this.state.message);

        this.setState({submitting: true, serverError: null});

        const isReaction = REACTION_PATTERN.exec(post.message);
        if (post.message.indexOf('/') === 0) {
            PostStore.storeDraft(this.state.channelId, null);
            this.setState({message: '', postError: null, fileInfos: [], enableSendButton: false});

            const args = {};
            args.channel_id = this.state.channelId;
            args.team_id = TeamStore.getCurrentId();
            ChannelActions.executeCommand(
                post.message,
                args,
                (data) => {
                    this.setState({submitting: false});

                    const hasGotoLocation = data.goto_location && isUrlSafe(data.goto_location);

                    if (post.message.trim() === '/logout') {
                        GlobalActions.clientLogout(hasGotoLocation ? data.goto_location : '/');
                        return;
                    }

                    if (hasGotoLocation) {
                        if (data.goto_location.startsWith('/') || data.goto_location.includes(window.location.hostname)) {
                            browserHistory.push(data.goto_location);
                        } else {
                            window.open(data.goto_location);
                        }
                    }
                },
                (err) => {
                    if (err.sendMessage) {
                        this.sendMessage(post);
                    } else {
                        this.setState({
                            serverError: err.message,
                            submitting: false,
                            message: post.message
                        });
                    }
                }
            );
        } else if (isReaction && EmojiStore.has(isReaction[2])) {
            this.sendReaction(isReaction);
        } else {
            this.sendMessage(post);
        }

        this.setState({
            message: '',
            submitting: false,
            postError: null,
            fileInfos: [],
            serverError: null,
            enableSendButton: false
        });

        const fasterThanHumanWillClick = 150;
        const forceFocus = (Date.now() - this.lastBlurAt < fasterThanHumanWillClick);

        this.focusTextbox(forceFocus);
    }

    handleNotifyAllConfirmation(e) {
        this.hideNotifyAllModal();
        this.doSubmit(e);
    }

    hideNotifyAllModal() {
        this.setState({showConfirmModal: false});
    }

    showNotifyAllModal() {
        this.setState({showConfirmModal: true});
    }

    handleSubmit(e) {
        const stats = ChannelStore.getCurrentStats();
        const members = stats.member_count - 1;
        const updateChannel = ChannelStore.getCurrent();

        if ((PostUtils.containsAtMention(this.state.message, '@all') || PostUtils.containsAtMention(this.state.message, '@channel')) && members >= Constants.NOTIFY_ALL_MEMBERS) {
            this.setState({totalMembers: members});
            this.showNotifyAllModal();
            return;
        }

        if (this.state.message.trimRight() === '/header') {
            GlobalActions.showChannelHeaderUpdateModal(updateChannel);
            this.setState({message: ''});
            return;
        }

        const isDirectOrGroup = ((updateChannel.type === Constants.DM_CHANNEL) || (updateChannel.type === Constants.GM_CHANNEL));
        if (!isDirectOrGroup && this.state.message.trimRight() === '/purpose') {
            GlobalActions.showChannelPurposeUpdateModal(updateChannel);
            this.setState({message: ''});
            return;
        }

        if (!isDirectOrGroup && this.state.message.trimRight() === '/rename') {
            GlobalActions.showChannelNameUpdateModal(updateChannel);
            this.setState({message: ''});
            return;
        }

        this.doSubmit(e);
    }

    handleNotifyModalCancel() {
        this.setState({showConfirmModal: false});
    }

    sendMessage(post) {
        post.channel_id = this.state.channelId;

        const time = Utils.getTimestamp();
        const userId = UserStore.getCurrentId();
        post.pending_post_id = `${userId}:${time}`;
        post.user_id = userId;
        post.create_at = time;
        post.parent_id = this.state.parentId;

        GlobalActions.emitUserPostedEvent(post);

        PostActions.createPost(post, this.state.fileInfos,
            () => GlobalActions.postListScrollChange(true),
            (err) => {
                if (err.id === 'api.post.create_post.root_id.app_error') {
                    // this should never actually happen since you can't reply from this textbox
                    this.showPostDeletedModal();
                } else {
                    this.forceUpdate();
                }

                this.setState({
                    submitting: false
                });
            }
        );
    }

    sendReaction(isReaction) {
        const action = isReaction[1];

        const emojiName = isReaction[2];
        const postId = PostStore.getLatestPostId(this.state.channelId);

        if (postId && action === '+') {
            PostActions.addReaction(this.state.channelId, postId, emojiName);
        } else if (postId && action === '-') {
            PostActions.removeReaction(this.state.channelId, postId, emojiName);
        }

        PostStore.storeDraft(this.state.channelId, null);
    }

    focusTextbox(keepFocus = false) {
        if (keepFocus || !UserAgent.isMobile()) {
            this.refs.textbox.focus();
        }
    }

    postMsgKeyPress(e) {
        if (!UserAgent.isMobile() && ((this.state.ctrlSend && e.ctrlKey) || !this.state.ctrlSend)) {
            if (e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                ReactDOM.findDOMNode(this.refs.textbox).blur();
                this.handleSubmit(e);
            }
        }

        GlobalActions.emitLocalUserTypingEvent(this.state.channelId, '');
    }

    handleChange(e) {
        const message = e.target.value;
        const enableSendButton = this.handleEnableSendButton(message, this.state.fileInfos);

        this.setState({
            message,
            enableSendButton
        });

        const draft = PostStore.getDraft(this.state.channelId);
        draft.message = message;
        PostStore.storeDraft(this.state.channelId, draft);
    }

    handleFileUploadChange() {
        this.focusTextbox(true);
    }

    handleUploadStart(clientIds, channelId) {
        const draft = PostStore.getDraft(channelId);

        draft.uploadsInProgress = draft.uploadsInProgress.concat(clientIds);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress});

        // this is a bit redundant with the code that sets focus when the file input is clicked,
        // but this also resets the focus after a drag and drop
        this.focusTextbox();
    }

    handleFileUploadComplete(fileInfos, clientIds, channelId) {
        const draft = PostStore.getDraft(channelId);

        // remove each finished file from uploads
        for (let i = 0; i < clientIds.length; i++) {
            const index = draft.uploadsInProgress.indexOf(clientIds[i]);

            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }
        }

        draft.fileInfos = draft.fileInfos.concat(fileInfos);
        PostStore.storeDraft(channelId, draft);

        if (channelId === this.state.channelId) {
            this.setState({
                uploadsInProgress: draft.uploadsInProgress,
                fileInfos: draft.fileInfos,
                enableSendButton: true
            });
        }
    }

    handleUploadError(err, clientId, channelId) {
        let message = err;
        if (message && typeof message !== 'string') {
            // err is an AppError from the server
            message = err.message;
        }

        if (clientId !== -1) {
            const draft = PostStore.getDraft(channelId);

            const index = draft.uploadsInProgress.indexOf(clientId);
            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }

            PostStore.storeDraft(channelId, draft);

            if (channelId === this.state.channelId) {
                this.setState({uploadsInProgress: draft.uploadsInProgress});
            }
        }

        this.setState({serverError: message});
    }

    removePreview(id) {
        const fileInfos = Object.assign([], this.state.fileInfos);
        const uploadsInProgress = this.state.uploadsInProgress;

        // Clear previous errors
        this.handleUploadError(null);

        // id can either be the id of an uploaded file or the client id of an in progress upload
        let index = fileInfos.findIndex((info) => info.id === id);
        if (index === -1) {
            index = uploadsInProgress.indexOf(id);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
                this.refs.fileUpload.getWrappedInstance().cancelUpload(id);
            }
        } else {
            fileInfos.splice(index, 1);
        }

        const draft = PostStore.getDraft(this.state.channelId);
        draft.fileInfos = fileInfos;
        draft.uploadsInProgress = uploadsInProgress;
        PostStore.storeDraft(this.state.channelId, draft);
        const enableSendButton = this.handleEnableSendButton(this.state.message, fileInfos);

        this.setState({fileInfos, uploadsInProgress, enableSendButton});

        this.handleFileUploadChange();
    }

    componentWillMount() {
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), 999);
        const enableSendButton = this.handleEnableSendButton(this.state.message, this.state.fileInfos);

        // wait to load these since they may have changed since the component was constructed (particularly in the case of skipping the tutorial)
        this.setState({
            ctrlSend: PreferenceStore.getBool(Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            fullWidthTextBox: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN,
            showTutorialTip: tutorialStep === TutorialSteps.POST_POPOVER,
            enableSendButton
        });
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);

        this.focusTextbox();
        document.addEventListener('keydown', this.showShortcuts);
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.channelId !== this.state.channelId) {
            this.focusTextbox();
        }
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        document.removeEventListener('keydown', this.showShortcuts);
    }

    showShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && e.keyCode === Constants.KeyCodes.FORWARD_SLASH) {
            e.preventDefault();

            GlobalActions.showShortcutsModal();
        }
    }

    onChange() {
        const channelId = ChannelStore.getCurrentId();
        if (this.state.channelId !== channelId) {
            const draft = PostStore.getDraft(channelId);

            this.setState({channelId, message: draft.message, submitting: false, serverError: null, postError: null, fileInfos: draft.fileInfos, uploadsInProgress: draft.uploadsInProgress});
        }
    }

    onPreferenceChange() {
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), 999);
        this.setState({
            showTutorialTip: tutorialStep === TutorialSteps.POST_POPOVER,
            ctrlSend: PreferenceStore.getBool(Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            fullWidthTextBox: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN
        });
    }

    getFileCount(channelId) {
        if (channelId === this.state.channelId) {
            return this.state.fileInfos.length + this.state.uploadsInProgress.length;
        }

        const draft = PostStore.getDraft(channelId);
        return draft.fileInfos.length + draft.uploadsInProgress.length;
    }

    getFileUploadTarget() {
        return this.refs.textbox;
    }

    getCreatePostControls() {
        return this.refs.createPostControls;
    }

    handleKeyDown(e) {
        if (this.state.ctrlSend && e.keyCode === KeyCodes.ENTER && e.ctrlKey === true) {
            this.postMsgKeyPress(e);
            return;
        }

        const latestReplyablePost = PostStore.getLatestReplyablePost(this.state.channelId);
        const latestReplyablePostId = latestReplyablePost == null ? '' : latestReplyablePost.id;
        const lastPostEl = document.getElementById(`commentIcon_${this.state.channelId}_${latestReplyablePostId}`);

        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.keyCode === KeyCodes.UP && this.state.message === '') {
            e.preventDefault();

            const lastPost = PostStore.getCurrentUsersLatestPost(this.state.channelId);
            if (!lastPost) {
                return;
            }

            let type;
            if (lastPost.root_id && lastPost.root_id.length > 0) {
                type = Utils.localizeMessage('create_post.comment', 'Comment');
            } else {
                type = Utils.localizeMessage('create_post.post', 'Post');
            }

            AppDispatcher.handleViewAction({
                type: ActionTypes.RECEIVED_EDIT_POST,
                refocusId: '#post_textbox',
                title: type,
                message: lastPost.message,
                postId: lastPost.id,
                channelId: lastPost.channel_id,
                comments: PostStore.getCommentCount(lastPost)
            });
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey && e.keyCode === KeyCodes.UP && this.state.message === '' && lastPostEl) {
            e.preventDefault();
            if (document.createEvent) {
                const evt = document.createEvent('MouseEvents');
                evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                lastPostEl.dispatchEvent(evt);
            } else if (document.createEventObject) {
                const evObj = document.createEventObject();
                lastPostEl.fireEvent('onclick', evObj);
            }
        }

        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.keyCode === Constants.KeyCodes.UP || e.keyCode === Constants.KeyCodes.DOWN)) {
            const lastMessage = MessageHistoryStore.nextMessageInHistory(e.keyCode, this.state.message, 'post');
            if (lastMessage !== null) {
                e.preventDefault();
                this.setState({
                    message: lastMessage
                });
            }
        }
    }

    handleBlur() {
        this.lastBlurAt = Date.now();
    }

    showPostDeletedModal() {
        this.setState({
            showPostDeletedModal: true
        });
    }

    hidePostDeletedModal() {
        this.setState({
            showPostDeletedModal: false
        });
    }

    handleEmojiClick(emoji) {
        const emojiAlias = emoji.name || emoji.aliases[0];

        if (!emojiAlias) {
            //Oops.. There went something wrong
            return;
        }

        if (this.state.message === '') {
            this.setState({message: ':' + emojiAlias + ': '});
        } else {
            //check whether there is already a blank at the end of the current message
            const newMessage = (/\s+$/.test(this.state.message)) ?
                this.state.message + ':' + emojiAlias + ': ' : this.state.message + ' :' + emojiAlias + ': ';

            this.setState({message: newMessage});
        }

        this.setState({showEmojiPicker: false});

        this.focusTextbox();
    }

    createTutorialTip() {
        const screens = [];

        screens.push(
            <div>
                <FormattedHTMLMessage
                    id='create_post.tutorialTip'
                    defaultMessage='<h4>Sending Messages</h4><p>Type here to write a message and press <strong>Enter</strong> to post it.</p><p>Click the <strong>Attachment</strong> button to upload an image or a file.</p>'
                />
            </div>
        );

        return (
            <TutorialTip
                placement='top'
                screens={screens}
                overlayClass='tip-overlay--chat'
                diagnosticsTag='tutorial_tip_1_sending_messages'
            />
        );
    }

    handleEnableSendButton(message, fileInfos) {
        return message.trim().length !== 0 || fileInfos.length !== 0;
    }

    render() {
        const notifyAllTitle = (
            <FormattedMessage
                id='notify_all.title.confirm'
                defaultMessage='Confirm sending notifications to entire channel'
            />
        );

        const notifyAllConfirm = (
            <FormattedMessage
                id='notify_all.confirm'
                defaultMessage='Confirm'
            />
        );

        const notifyAllMessage = (
            <FormattedMessage
                id='notify_all.question'
                defaultMessage='By using @all or @channel you are about to send notifications to {totalMembers} people. Are you sure you want to do this?'
                values={{
                    totalMembers: this.state.totalMembers
                }}
            />
        );

        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='has-error'>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        let postError = null;
        if (this.state.postError) {
            const postErrorClass = 'post-error' + (this.state.errorClass ? (' ' + this.state.errorClass) : '');
            postError = <label className={postErrorClass}>{this.state.postError}</label>;
        }

        let preview = null;
        if (this.state.fileInfos.length > 0 || this.state.uploadsInProgress.length > 0) {
            preview = (
                <FilePreview
                    fileInfos={this.state.fileInfos}
                    onRemove={this.removePreview}
                    uploadsInProgress={this.state.uploadsInProgress}
                />
            );
        }

        let postFooterClassName = 'post-create-footer';
        if (postError) {
            postFooterClassName += ' has-error';
        }

        let tutorialTip = null;
        if (this.state.showTutorialTip) {
            tutorialTip = this.createTutorialTip();
        }

        let centerClass = '';
        if (!this.state.fullWidthTextBox) {
            centerClass = 'center';
        }

        let sendButtonClass = 'send-button theme';
        if (!this.state.enableSendButton) {
            sendButtonClass += ' disabled';
        }

        let attachmentsDisabled = '';
        if (!FileUtils.canUploadFiles()) {
            attachmentsDisabled = ' post-create--attachment-disabled';
        }

        const fileUpload = (
            <FileUpload
                ref='fileUpload'
                getFileCount={this.getFileCount}
                getTarget={this.getFileUploadTarget}
                onFileUploadChange={this.handleFileUploadChange}
                onUploadStart={this.handleUploadStart}
                onFileUpload={this.handleFileUploadComplete}
                onUploadError={this.handleUploadError}
                postType='post'
                channelId=''
            />
        );

        let emojiPicker = null;
        if (window.mm_config.EnableEmojiPicker === 'true') {
            emojiPicker = (
                <span className='emoji-picker__container'>
                    <EmojiPickerOverlay
                        show={this.state.showEmojiPicker}
                        container={this.props.getChannelView}
                        target={this.getCreatePostControls}
                        onHide={this.hideEmojiPicker}
                        onEmojiClick={this.handleEmojiClick}
                        rightOffset={15}
                        topOffset={-7}
                    />
                    <span
                        className='icon icon--emoji'
                        dangerouslySetInnerHTML={{__html: Constants.EMOJI_ICON_SVG}}
                        onClick={this.toggleEmojiPicker}
                        onMouseOver={EmojiPicker.beginPreloading}
                    />
                </span>
            );
        }

        return (
            <form
                id='create_post'
                ref='topDiv'
                role='form'
                className={centerClass}
                onSubmit={this.handleSubmit}
            >
                <div className={'post-create' + attachmentsDisabled}>
                    <div className='post-create-body'>
                        <div className='post-body__cell'>
                            <Textbox
                                onChange={this.handleChange}
                                onKeyPress={this.postMsgKeyPress}
                                onKeyDown={this.handleKeyDown}
                                handlePostError={this.handlePostError}
                                value={this.state.message}
                                onBlur={this.handleBlur}
                                emojiEnabled={window.mm_config.EnableEmojiPicker === 'true'}
                                createMessage={Utils.localizeMessage('create_post.write', 'Write a message...')}
                                channelId={this.state.channelId}
                                popoverMentionKeyClick={true}
                                id='post_textbox'
                                ref='textbox'
                            />
                            <span
                                ref='createPostControls'
                                className='post-body__actions'
                            >
                                {fileUpload}
                                {emojiPicker}
                                <a
                                    className={sendButtonClass}
                                    onClick={this.handleSubmit}
                                >
                                    <i className='fa fa-paper-plane'/>
                                </a>
                            </span>
                        </div>
                        {tutorialTip}
                    </div>
                    <div className={postFooterClassName}>
                        <MsgTyping
                            channelId={this.state.channelId}
                            parentId=''
                        />
                        {postError}
                        {preview}
                        {serverError}
                    </div>
                </div>
                <PostDeletedModal
                    show={this.state.showPostDeletedModal}
                    onHide={this.hidePostDeletedModal}
                />
                <ConfirmModal
                    title={notifyAllTitle}
                    message={notifyAllMessage}
                    confirmButtonText={notifyAllConfirm}
                    show={this.state.showConfirmModal}
                    onConfirm={this.handleNotifyAllConfirmation}
                    onCancel={this.handleNotifyModalCancel}
                />
            </form>
        );
    }
}

CreatePost.propTypes = {
    getChannelView: PropTypes.func
};
