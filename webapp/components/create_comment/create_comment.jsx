// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import * as ChannelActions from 'actions/channel_actions.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PostDeletedModal from 'components/post_deleted_modal.jsx';
import PostStore from 'stores/post_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import MessageHistoryStore from 'stores/message_history_store.jsx';
import Textbox from 'components/textbox.jsx';
import MsgTyping from 'components/msg_typing.jsx';
import FileUpload from 'components/file_upload.jsx';
import FilePreview from 'components/file_preview.jsx';
import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay.jsx';
import * as EmojiPicker from 'components/emoji_picker/emoji_picker.jsx';
import {isUrlSafe} from 'utils/url.jsx';
import * as Utils from 'utils/utils.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';

import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

import {REACTION_PATTERN} from 'components/create_post.jsx';
import PropTypes from 'prop-types';
import React from 'react';

export default class CreateComment extends React.Component {
    static propTypes = {
        channelId: PropTypes.string.isRequired,
        rootId: PropTypes.string.isRequired,
        latestPostId: PropTypes.string,
        getSidebarBody: PropTypes.func,
        createPostErrorId: PropTypes.string
    }

    constructor(props) {
        super(props);

        this.lastTime = 0;

        PostStore.clearCommentDraftUploads();
        MessageHistoryStore.resetHistoryIndex('comment');

        const draft = PostStore.getCommentDraft(this.props.rootId);
        const enableAddButton = this.handleEnableAddButton(draft.message, draft.fileInfos);
        this.state = {
            message: draft.message,
            uploadsInProgress: draft.uploadsInProgress,
            fileInfos: draft.fileInfos,
            submitting: false,
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            showPostDeletedModal: false,
            enableAddButton,
            showEmojiPicker: false
        };

        this.lastBlurAt = 0;
    }

    toggleEmojiPicker = () => {
        this.setState({showEmojiPicker: !this.state.showEmojiPicker});
    }

    hideEmojiPicker = () => {
        this.setState({showEmojiPicker: false});
    }

    handleEmojiClick = (emoji) => {
        const emojiAlias = emoji.name || emoji.aliases[0];

        if (!emojiAlias) {
            //Oops.. There went something wrong
            return;
        }

        if (this.state.message === '') {
            this.setState({message: ':' + emojiAlias + ': '});
        } else {
            // Check whether there is already a blank at the end of the current message
            let newMessage;
            if ((/\s+$/).test(this.state.message)) {
                newMessage = this.state.message + ':' + emojiAlias + ': ';
            } else {
                newMessage = this.state.message + ' :' + emojiAlias + ': ';
            }

            this.setState({message: newMessage});
        }

        this.setState({showEmojiPicker: false});

        this.focusTextbox();
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);

        this.focusTextbox();
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }

    onPreferenceChange = () => {
        this.setState({
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter')
        });
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.uploadsInProgress < this.state.uploadsInProgress) {
            $('.post-right__scroll').scrollTop($('.post-right__scroll')[0].scrollHeight);
        }

        if (prevProps.rootId !== this.props.rootId) {
            this.focusTextbox();
        }
    }

    handlePostError = (postError) => {
        this.setState({postError});
    }

    handleSubmit = (e) => {
        e.preventDefault();

        if (this.state.uploadsInProgress.length > 0 || this.state.submitting) {
            return;
        }

        const message = this.state.message;

        if (this.state.postError) {
            this.setState({errorClass: 'animation--highlight'});
            setTimeout(() => {
                this.setState({errorClass: null});
            }, Constants.ANIMATION_TIMEOUT);
            return;
        }

        MessageHistoryStore.storeMessageInHistory(message);
        if (message.trim().length === 0 && this.state.fileInfos.length === 0) {
            return;
        }

        const isReaction = REACTION_PATTERN.exec(message);
        if (isReaction && EmojiStore.has(isReaction[2])) {
            this.handleSubmitReaction(isReaction);
        } else if (message.indexOf('/') === 0) {
            this.handleSubmitCommand(message);
        } else {
            this.handleSubmitPost(message);
        }

        this.setState({
            message: '',
            submitting: false,
            postError: null,
            fileInfos: [],
            serverError: null,
            enableAddButton: false
        });

        const fasterThanHumanWillClick = 150;
        const forceFocus = (Date.now() - this.lastBlurAt < fasterThanHumanWillClick);
        this.focusTextbox(forceFocus);
    }

    handleSubmitCommand = (message) => {
        PostStore.storeCommentDraft(this.props.rootId, null);
        this.setState({
            message: '',
            postError: null,
            fileInfos: [],
            enableAddButton: false
        });

        const args = {};
        args.channel_id = this.props.channelId;
        args.team_id = TeamStore.getCurrentId();
        args.root_id = this.props.rootId;
        args.parent_id = this.props.rootId;
        ChannelActions.executeCommand(
            message,
            args,
            (data) => {
                this.setState({submitting: false});

                const hasGotoLocation = data.goto_location && isUrlSafe(data.goto_location);

                if (message.trim() === '/logout') {
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
                    this.handleSubmitPost(message);
                } else {
                    const state = {};
                    state.serverError = err.message;
                    state.submitting = false;
                    this.setState(state);
                }
            }
        );
    }

    handleSubmitPost = (message) => {
        const userId = UserStore.getCurrentId();
        const time = Utils.getTimestamp();

        const post = {};
        post.file_ids = [];
        post.message = message;
        post.channel_id = this.props.channelId;
        post.root_id = this.props.rootId;
        post.parent_id = this.props.rootId;
        post.pending_post_id = `${userId}:${time}`;
        post.user_id = userId;
        post.create_at = time;

        GlobalActions.emitUserCommentedEvent(post);

        PostActions.createPost(post, this.state.fileInfos);

        this.setState({
            message: '',
            submitting: false,
            postError: null,
            fileInfos: [],
            serverError: null,
            enableAddButton: false
        });

        const fasterThanHumanWillClick = 150;
        const forceFocus = (Date.now() - this.state.lastBlurAt < fasterThanHumanWillClick);
        this.focusTextbox(forceFocus);
    }

    handleSubmitReaction = (isReaction) => {
        const action = isReaction[1];

        const emojiName = isReaction[2];
        const postId = this.props.latestPostId;

        if (action === '+') {
            PostActions.addReaction(this.props.channelId, postId, emojiName);
        } else if (action === '-') {
            PostActions.removeReaction(this.props.channelId, postId, emojiName);
        }

        PostStore.storeCommentDraft(this.props.rootId, null);
    }

    commentMsgKeyPress = (e) => {
        if (!UserAgent.isMobile() && ((this.state.ctrlSend && e.ctrlKey) || !this.state.ctrlSend)) {
            if (e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                ReactDOM.findDOMNode(this.refs.textbox).blur();
                this.handleSubmit(e);
            }
        }

        GlobalActions.emitLocalUserTypingEvent(this.props.channelId, this.props.rootId);
    }

    handleChange = (e) => {
        const message = e.target.value;

        const draft = PostStore.getCommentDraft(this.props.rootId);
        draft.message = message;
        PostStore.storeCommentDraft(this.props.rootId, draft);

        $('.post-right__scroll').parent().scrollTop($('.post-right__scroll')[0].scrollHeight);

        const enableAddButton = this.handleEnableAddButton(message, this.state.fileInfos);

        this.setState({
            message,
            enableAddButton
        });
    }

    handleKeyDown = (e) => {
        if (this.state.ctrlSend && e.keyCode === KeyCodes.ENTER && e.ctrlKey === true) {
            this.commentMsgKeyPress(e);
            return;
        }

        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.keyCode === KeyCodes.UP && this.state.message === '') {
            e.preventDefault();

            const lastPost = PostStore.getCurrentUsersLatestPost(this.props.channelId, this.props.rootId);
            if (!lastPost) {
                return;
            }

            AppDispatcher.handleViewAction({
                type: ActionTypes.RECEIVED_EDIT_POST,
                refocusId: '#reply_textbox',
                title: Utils.localizeMessage('create_comment.commentTitle', 'Comment'),
                message: lastPost.message,
                postId: lastPost.id,
                channelId: lastPost.channel_id,
                comments: PostStore.getCommentCount(lastPost)
            });
        }

        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.keyCode === Constants.KeyCodes.UP || e.keyCode === Constants.KeyCodes.DOWN)) {
            const lastMessage = MessageHistoryStore.nextMessageInHistory(e.keyCode, this.state.message, 'comment');
            if (lastMessage !== null) {
                e.preventDefault();
                this.setState({
                    message: lastMessage,
                    enableAddButton: true
                });
            }
        }
    }

    handleFileUploadChange = () => {
        this.focusTextbox();
    }

    handleUploadStart = (clientIds) => {
        const draft = PostStore.getCommentDraft(this.props.rootId);

        draft.uploadsInProgress = draft.uploadsInProgress.concat(clientIds);
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress});

        // this is a bit redundant with the code that sets focus when the file input is clicked,
        // but this also resets the focus after a drag and drop
        this.focusTextbox();
    }

    handleFileUploadComplete = (fileInfos, clientIds) => {
        const draft = PostStore.getCommentDraft(this.props.rootId);

        // remove each finished file from uploads
        for (let i = 0; i < clientIds.length; i++) {
            const index = draft.uploadsInProgress.indexOf(clientIds[i]);

            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }
        }

        draft.fileInfos = draft.fileInfos.concat(fileInfos);
        PostStore.storeCommentDraft(this.props.rootId, draft);

        // Focus on preview if needed/possible - if user has switched teams since starting the file upload,
        // the preview will be undefined and the switch will fail
        if (typeof this.refs.preview != 'undefined' && this.refs.preview) {
            this.refs.preview.refs.container.scrollIntoView();
        }

        const enableAddButton = this.handleEnableAddButton(draft.message, draft.fileInfos);

        this.setState({
            uploadsInProgress: draft.uploadsInProgress,
            fileInfos: draft.fileInfos,
            enableAddButton
        });
    }

    handleUploadError = (err, clientId) => {
        if (clientId === -1) {
            this.setState({serverError: err});
        } else {
            const draft = PostStore.getCommentDraft(this.props.rootId);

            const index = draft.uploadsInProgress.indexOf(clientId);
            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }

            PostStore.storeCommentDraft(this.props.rootId, draft);

            this.setState({uploadsInProgress: draft.uploadsInProgress, serverError: err});
        }
    }

    removePreview = (id) => {
        const fileInfos = this.state.fileInfos;
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

        const draft = PostStore.getCommentDraft(this.props.rootId);
        draft.fileInfos = fileInfos;
        draft.uploadsInProgress = uploadsInProgress;
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({fileInfos, uploadsInProgress});

        this.handleFileUploadChange();
    }

    componentWillReceiveProps(newProps) {
        if (newProps.rootId !== this.props.rootId) {
            const draft = PostStore.getCommentDraft(newProps.rootId);
            const enableAddButton = this.handleEnableAddButton(draft.message, draft.fileInfos);
            this.setState({
                message: draft.message,
                uploadsInProgress: draft.uploadsInProgress,
                fileInfos: draft.fileInfos,
                enableAddButton
            });
        }

        if (newProps.createPostErrorId === 'api.post.create_post.root_id.app_error' && newProps.createPostErrorId !== this.props.createPostErrorId) {
            this.showPostDeletedModal();
        }
    }

    getFileCount = () => {
        return this.state.fileInfos.length + this.state.uploadsInProgress.length;
    }

    getFileUploadTarget = () => {
        return this.refs.textbox;
    }

    getCreateCommentControls = () => {
        return this.refs.createCommentControls;
    }

    focusTextbox = (keepFocus = false) => {
        if (keepFocus || !UserAgent.isMobile()) {
            this.refs.textbox.focus();
        }
    }

    showPostDeletedModal = () => {
        this.setState({
            showPostDeletedModal: true
        });
    }

    hidePostDeletedModal = () => {
        this.setState({
            showPostDeletedModal: false
        });
    }

    handleBlur = () => {
        this.lastBlurAt = Date.now();
    }

    handleEnableAddButton = (message, fileInfos) => {
        return message.trim().length !== 0 || fileInfos.length !== 0;
    }

    render() {
        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='form-group has-error'>
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
                    ref='preview'
                />
            );
        }

        let uploadsInProgressText = null;
        if (this.state.uploadsInProgress.length > 0) {
            uploadsInProgressText = (
                <span className='pull-right post-right-comments-upload-in-progress'>
                    {this.state.uploadsInProgress.length === 1 ? (
                        <FormattedMessage
                            id='create_comment.file'
                            defaultMessage='File uploading'
                        />
                    ) : (
                        <FormattedMessage
                            id='create_comment.files'
                            defaultMessage='Files uploading'
                        />
                    )}
                </span>
            );
        }

        let addButtonClass = 'btn btn-primary comment-btn pull-right';
        if (!this.state.enableAddButton) {
            addButtonClass += ' disabled';
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
                postType='comment'
                channelId={this.props.channelId}
            />
        );

        let emojiPicker = null;
        if (window.mm_config.EnableEmojiPicker === 'true') {
            emojiPicker = (
                <span className='emoji-picker__container'>
                    <EmojiPickerOverlay
                        show={this.state.showEmojiPicker}
                        container={this.props.getSidebarBody}
                        target={this.getCreateCommentControls}
                        onHide={this.hideEmojiPicker}
                        onEmojiClick={this.handleEmojiClick}
                        rightOffset={15}
                        topOffset={55}
                    />
                    <span
                        className='icon icon--emoji emoji-rhs'
                        dangerouslySetInnerHTML={{__html: Constants.EMOJI_ICON_SVG}}
                        onClick={this.toggleEmojiPicker}
                        onMouseOver={EmojiPicker.beginPreloading}
                    />
                </span>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className='post-create'>
                    <div
                        id={this.props.rootId}
                        className='post-create-body comment-create-body'
                    >
                        <div className='post-body__cell'>
                            <Textbox
                                onChange={this.handleChange}
                                onKeyPress={this.commentMsgKeyPress}
                                onKeyDown={this.handleKeyDown}
                                handlePostError={this.handlePostError}
                                value={this.state.message}
                                onBlur={this.handleBlur}
                                createMessage={Utils.localizeMessage('create_comment.addComment', 'Add a comment...')}
                                emojiEnabled={window.mm_config.EnableEmojiPicker === 'true'}
                                initialText=''
                                channelId={this.props.channelId}
                                isRHS={true}
                                popoverMentionKeyClick={true}
                                id='reply_textbox'
                                ref='textbox'
                            />
                            <span
                                ref='createCommentControls'
                                className='post-body__actions'
                            >
                                {fileUpload}
                                {emojiPicker}
                            </span>
                        </div>
                    </div>
                    <MsgTyping
                        channelId={this.props.channelId}
                        parentId={this.props.rootId}
                    />
                    <div className='post-create-footer'>
                        <input
                            type='button'
                            className={addButtonClass}
                            value={Utils.localizeMessage('create_comment.comment', 'Add Comment')}
                            onClick={this.handleSubmit}
                        />
                        {uploadsInProgressText}
                        {postError}
                        {preview}
                        {serverError}
                    </div>
                </div>
                <PostDeletedModal
                    show={this.state.showPostDeletedModal}
                    onHide={this.hidePostDeletedModal}
                />
            </form>
        );
    }
}
