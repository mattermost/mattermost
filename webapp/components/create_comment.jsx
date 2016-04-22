// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PostDeletedModal from './post_deleted_modal.jsx';
import PostStore from 'stores/post_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import Textbox from './textbox.jsx';
import MsgTyping from './msg_typing.jsx';
import FileUpload from './file_upload.jsx';
import FilePreview from './file_preview.jsx';
import * as Utils from 'utils/utils.jsx';
import * as GlobalActions from 'action_creators/global_actions.jsx';

import Constants from 'utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

const holders = defineMessages({
    commentLength: {
        id: 'create_comment.commentLength',
        defaultMessage: 'Comment length must be less than {max} characters.'
    },
    comment: {
        id: 'create_comment.comment',
        defaultMessage: 'Add Comment'
    },
    addComment: {
        id: 'create_comment.addComment',
        defaultMessage: 'Add a comment...'
    },
    commentTitle: {
        id: 'create_comment.commentTitle',
        defaultMessage: 'Comment'
    }
});

import React from 'react';

class CreateComment extends React.Component {
    constructor(props) {
        super(props);

        this.lastTime = 0;

        this.handleSubmit = this.handleSubmit.bind(this);
        this.commentMsgKeyPress = this.commentMsgKeyPress.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleUploadClick = this.handleUploadClick.bind(this);
        this.handleUploadStart = this.handleUploadStart.bind(this);
        this.handleFileUploadComplete = this.handleFileUploadComplete.bind(this);
        this.handleUploadError = this.handleUploadError.bind(this);
        this.removePreview = this.removePreview.bind(this);
        this.getFileCount = this.getFileCount.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.focusTextbox = this.focusTextbox.bind(this);
        this.showPostDeletedModal = this.showPostDeletedModal.bind(this);
        this.hidePostDeletedModal = this.hidePostDeletedModal.bind(this);

        PostStore.clearCommentDraftUploads();

        const draft = PostStore.getCommentDraft(this.props.rootId);
        this.state = {
            messageText: draft.message,
            uploadsInProgress: draft.uploadsInProgress,
            previews: draft.previews,
            submitting: false,
            windowWidth: Utils.windowWidth(),
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            showPostDeletedModal: false
        };
    }
    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        window.addEventListener('resize', this.handleResize);

        this.focusTextbox();
    }
    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        window.removeEventListener('resize', this.handleResize);
    }
    onPreferenceChange() {
        this.setState({
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter')
        });
    }
    handleResize() {
        this.setState({windowWidth: Utils.windowWidth()});
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevState.uploadsInProgress < this.state.uploadsInProgress) {
            $('.post-right__scroll').scrollTop($('.post-right__scroll')[0].scrollHeight);
        }

        if (prevProps.rootId !== this.props.rootId) {
            this.focusTextbox();
        }
    }
    handleSubmit(e) {
        e.preventDefault();

        if (this.state.uploadsInProgress.length > 0) {
            return;
        }

        if (this.state.submitting) {
            return;
        }

        let post = {};
        post.filenames = [];
        post.message = this.state.messageText;

        if (post.message.trim().length === 0 && this.state.previews.length === 0) {
            return;
        }

        if (post.message.length > Constants.CHARACTER_LIMIT) {
            this.setState({postError: this.props.intl.formatMessage(holders.commentLength, {max: Constants.CHARACTER_LIMIT})});
            return;
        }

        const userId = UserStore.getCurrentId();

        post.channel_id = this.props.channelId;
        post.root_id = this.props.rootId;
        post.parent_id = this.props.rootId;
        post.filenames = this.state.previews;
        const time = Utils.getTimestamp();
        post.pending_post_id = `${userId}:${time}`;
        post.user_id = userId;
        post.create_at = time;

        PostStore.storePendingPost(post);
        PostStore.storeCommentDraft(this.props.rootId, null);

        Client.createPost(
            post,
            (data) => {
                AsyncClient.getPosts(this.props.channelId);

                const channel = ChannelStore.get(this.props.channelId);
                let member = ChannelStore.getMember(this.props.channelId);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = Date.now();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POST,
                    post: data
                });
            },
            (err) => {
                if (err.id === 'api.post.create_post.root_id.app_error') {
                    this.showPostDeletedModal();

                    PostStore.removePendingPost(post.channel_id, post.pending_post_id);
                } else {
                    post.state = Constants.POST_FAILED;
                    PostStore.updatePendingPost(post);
                }

                this.setState({
                    submitting: false
                });
            }
        );

        this.setState({
            messageText: '',
            submitting: false,
            postError: null,
            previews: [],
            serverError: null
        });
    }
    commentMsgKeyPress(e) {
        if (this.state.ctrlSend && e.ctrlKey || !this.state.ctrlSend) {
            if (e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                ReactDOM.findDOMNode(this.refs.textbox).blur();
                this.handleSubmit(e);
            }
        }

        GlobalActions.emitLocalUserTypingEvent(this.props.channelId, this.props.rootId);
    }
    handleUserInput(messageText) {
        let draft = PostStore.getCommentDraft(this.props.rootId);
        draft.message = messageText;
        PostStore.storeCommentDraft(this.props.rootId, draft);

        $('.post-right__scroll').parent().scrollTop($('.post-right__scroll')[0].scrollHeight);
        this.setState({messageText: messageText});
    }
    handleKeyDown(e) {
        if (this.state.ctrlSend && e.keyCode === KeyCodes.ENTER && e.ctrlKey === true) {
            this.commentMsgKeyPress(e);
            return;
        }

        if (e.keyCode === KeyCodes.UP && this.state.messageText === '') {
            e.preventDefault();

            const lastPost = PostStore.getCurrentUsersLatestPost(this.props.channelId, this.props.rootId);
            if (!lastPost) {
                return;
            }

            AppDispatcher.handleViewAction({
                type: ActionTypes.RECEIVED_EDIT_POST,
                refocusId: '#reply_textbox',
                title: this.props.intl.formatMessage(holders.commentTitle),
                message: lastPost.message,
                postId: lastPost.id,
                channelId: lastPost.channel_id,
                comments: PostStore.getCommentCount(lastPost)
            });
        }
    }
    handleUploadClick() {
        this.focusTextbox();
    }
    handleUploadStart(clientIds) {
        let draft = PostStore.getCommentDraft(this.props.rootId);

        draft.uploadsInProgress = draft.uploadsInProgress.concat(clientIds);
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress});

        // this is a bit redundant with the code that sets focus when the file input is clicked,
        // but this also resets the focus after a drag and drop
        this.focusTextbox();
    }
    handleFileUploadComplete(filenames, clientIds) {
        let draft = PostStore.getCommentDraft(this.props.rootId);

        // remove each finished file from uploads
        for (let i = 0; i < clientIds.length; i++) {
            const index = draft.uploadsInProgress.indexOf(clientIds[i]);

            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }
        }

        draft.previews = draft.previews.concat(filenames);
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress, previews: draft.previews});
    }
    handleUploadError(err, clientId) {
        if (clientId === -1) {
            this.setState({serverError: err});
        } else {
            let draft = PostStore.getCommentDraft(this.props.rootId);

            const index = draft.uploadsInProgress.indexOf(clientId);
            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }

            PostStore.storeCommentDraft(this.props.rootId, draft);

            this.setState({uploadsInProgress: draft.uploadsInProgress, serverError: err});
        }
    }
    removePreview(id) {
        let previews = this.state.previews;
        let uploadsInProgress = this.state.uploadsInProgress;

        // id can either be the path of an uploaded file or the client id of an in progress upload
        let index = previews.indexOf(id);
        if (index === -1) {
            index = uploadsInProgress.indexOf(id);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
                this.refs.fileUpload.getWrappedInstance().cancelUpload(id);
            }
        } else {
            previews.splice(index, 1);
        }

        let draft = PostStore.getCommentDraft(this.props.rootId);
        draft.previews = previews;
        draft.uploadsInProgress = uploadsInProgress;
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({previews: previews, uploadsInProgress: uploadsInProgress});
    }
    componentWillReceiveProps(newProps) {
        if (newProps.rootId !== this.props.rootId) {
            const draft = PostStore.getCommentDraft(newProps.rootId);
            this.setState({messageText: draft.message, uploadsInProgress: draft.uploadsInProgress, previews: draft.previews});
        }
    }
    getFileCount() {
        return this.state.previews.length + this.state.uploadsInProgress.length;
    }
    focusTextbox() {
        if (!Utils.isMobile()) {
            this.refs.textbox.focus();
        }
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
            postError = <label className='control-label'>{this.state.postError}</label>;
        }

        let preview = null;
        if (this.state.previews.length > 0 || this.state.uploadsInProgress.length > 0) {
            preview = (
                <FilePreview
                    files={this.state.previews}
                    onRemove={this.removePreview}
                    uploadsInProgress={this.state.uploadsInProgress}
                />
            );
        }

        let postFooterClassName = 'post-create-footer';
        if (postError) {
            postFooterClassName += ' has-error';
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

        const {formatMessage} = this.props.intl;
        return (
            <form onSubmit={this.handleSubmit}>
                <div className='post-create'>
                    <div
                        id={this.props.rootId}
                        className='post-create-body comment-create-body'
                    >
                        <div className='post-body__cell'>
                            <Textbox
                                onUserInput={this.handleUserInput}
                                onKeyPress={this.commentMsgKeyPress}
                                onKeyDown={this.handleKeyDown}
                                messageText={this.state.messageText}
                                createMessage={formatMessage(holders.addComment)}
                                initialText=''
                                supportsCommands={false}
                                id='reply_textbox'
                                ref='textbox'
                            />
                            <FileUpload
                                ref='fileUpload'
                                getFileCount={this.getFileCount}
                                onClick={this.handleUploadClick}
                                onUploadStart={this.handleUploadStart}
                                onFileUpload={this.handleFileUploadComplete}
                                onUploadError={this.handleUploadError}
                                postType='comment'
                                channelId={this.props.channelId}
                            />
                        </div>
                    </div>
                    <MsgTyping
                        channelId={this.props.channelId}
                        parentId={this.props.rootId}
                    />
                    <div className={postFooterClassName}>
                        <input
                            type='button'
                            className='btn btn-primary comment-btn pull-right'
                            value={formatMessage(holders.comment)}
                            onClick={this.handleSubmit}
                        />
                        {uploadsInProgressText}
                        {preview}
                        {postError}
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

CreateComment.propTypes = {
    intl: intlShape.isRequired,
    channelId: React.PropTypes.string.isRequired,
    rootId: React.PropTypes.string.isRequired
};

export default injectIntl(CreateComment);
