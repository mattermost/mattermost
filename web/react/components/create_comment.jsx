// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import SocketStore from '../stores/socket_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import UserStore from '../stores/user_store.jsx';
import PostStore from '../stores/post_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';
import Textbox from './textbox.jsx';
import MsgTyping from './msg_typing.jsx';
import FileUpload from './file_upload.jsx';
import FilePreview from './file_preview.jsx';
import * as Utils from '../utils/utils.jsx';

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

export default class CreateComment extends React.Component {
    constructor(props) {
        super(props);

        this.lastTime = 0;

        this.handleSubmit = this.handleSubmit.bind(this);
        this.commentMsgKeyPress = this.commentMsgKeyPress.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleUploadStart = this.handleUploadStart.bind(this);
        this.handleFileUploadComplete = this.handleFileUploadComplete.bind(this);
        this.handleUploadError = this.handleUploadError.bind(this);
        this.handleTextDrop = this.handleTextDrop.bind(this);
        this.removePreview = this.removePreview.bind(this);
        this.getFileCount = this.getFileCount.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);

        PostStore.clearCommentDraftUploads();

        const draft = PostStore.getCommentDraft(this.props.rootId);
        this.state = {
            messageText: draft.message,
            uploadsInProgress: draft.uploadsInProgress,
            previews: draft.previews,
            submitting: false,
            windowWidth: Utils.windowWidth(),
            ctrlSend: PreferenceStore.getPreference(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', {value: 'false'}).value
        };
    }
    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        window.removeEventListener('resize', this.handleResize);
    }
    onPreferenceChange() {
        this.setState({
            ctrlSend: PreferenceStore.getPreference(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', {value: 'false'}).value
        });
    }
    handleResize() {
        this.setState({windowWidth: Utils.windowWidth()});
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevState.uploadsInProgress < this.state.uploadsInProgress) {
            $('.post-right__scroll').scrollTop($('.post-right__scroll')[0].scrollHeight);
            if (this.state.windowWidth > 768) {
                $('.post-right__scroll').perfectScrollbar('update');
            }
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
            this.setState({postError: `Comment length must be less than ${Constants.CHARACTER_LIMIT} characters.`});
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

        Client.createPost(post, ChannelStore.getCurrent(),
            function handlePostSuccess(data) {
                AsyncClient.getPosts(this.props.channelId);

                const channel = ChannelStore.get(this.props.channelId);
                let member = ChannelStore.getMember(this.props.channelId);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = Date.now();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_POST,
                    post: data
                });
            }.bind(this),
            function handlePostError(err) {
                let state = {};

                if (err.message === 'Invalid RootId parameter') {
                    PostStore.removePendingPost(post.channel_id, post.pending_post_id);

                    if ($('#post_deleted').length > 0) {
                        $('#post_deleted').modal('show');
                    }
                } else {
                    post.state = Constants.POST_FAILED;
                    PostStore.updatePendingPost(post);
                }

                state.submitting = false;
                this.setState(state);
            }.bind(this)
        );

        this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});
    }
    commentMsgKeyPress(e) {
        if (this.state.ctrlSend === 'true' && e.ctrlKey || this.state.ctrlSend === 'false') {
            if (e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                ReactDOM.findDOMNode(this.refs.textbox).blur();
                this.handleSubmit(e);
            }
        }

        const t = Date.now();
        if ((t - this.lastTime) > Constants.UPDATE_TYPING_MS) {
            SocketStore.sendMessage({channel_id: this.props.channelId, action: 'typing', props: {parent_id: this.props.rootId}});
            this.lastTime = t;
        }
    }
    handleUserInput(messageText) {
        let draft = PostStore.getCommentDraft(this.props.rootId);
        draft.message = messageText;
        PostStore.storeCommentDraft(this.props.rootId, draft);

        $('.post-right__scroll').scrollTop($('.post-right__scroll')[0].scrollHeight);
        $('.post-right__scroll').perfectScrollbar('update');
        this.setState({messageText: messageText});
    }
    handleKeyDown(e) {
        if (this.state.ctrlSend === 'true' && e.keyCode === KeyCodes.ENTER && e.ctrlKey === true) {
            this.commentMsgKeyPress(e);
            return;
        }

        if (e.keyCode === KeyCodes.UP && this.state.messageText === '') {
            e.preventDefault();

            const channelId = ChannelStore.getCurrentId();
            const lastPost = PostStore.getCurrentUsersLatestPost(channelId, this.props.rootId);
            if (!lastPost) {
                return;
            }

            AppDispatcher.handleViewAction({
                type: ActionTypes.RECIEVED_EDIT_POST,
                refocusId: '#reply_textbox',
                title: 'Comment',
                message: lastPost.message,
                postId: lastPost.id,
                channelId: lastPost.channel_id,
                comments: PostStore.getCommentCount(lastPost)
            });
        }
    }
    handleUploadStart(clientIds) {
        let draft = PostStore.getCommentDraft(this.props.rootId);

        draft.uploadsInProgress = draft.uploadsInProgress.concat(clientIds);
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress});
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
    handleTextDrop(text) {
        const newText = this.state.messageText + text;
        this.handleUserInput(newText);
        Utils.setCaretPosition(ReactDOM.findDOMNode(this.refs.textbox.refs.message), newText.length);
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
                this.refs.fileUpload.cancelUpload(id);
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
                <span
                    className='pull-right post-right-comments-upload-in-progress'
                >
                    {this.state.uploadsInProgress.length === 1 ? 'File uploading' : 'Files uploading'}
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
                                onUserInput={this.handleUserInput}
                                onKeyPress={this.commentMsgKeyPress}
                                onKeyDown={this.handleKeyDown}
                                messageText={this.state.messageText}
                                createMessage='Add a comment...'
                                initialText=''
                                supportsCommands={false}
                                id='reply_textbox'
                                ref='textbox'
                            />
                            <FileUpload
                                ref='fileUpload'
                                getFileCount={this.getFileCount}
                                onUploadStart={this.handleUploadStart}
                                onFileUpload={this.handleFileUploadComplete}
                                onUploadError={this.handleUploadError}
                                onTextDrop={this.handleTextDrop}
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
                            value='Add Comment'
                            onClick={this.handleSubmit}
                        />
                        {uploadsInProgressText}
                        {preview}
                        {postError}
                        {serverError}
                    </div>
                </div>
            </form>
        );
    }
}

CreateComment.propTypes = {
    channelId: React.PropTypes.string.isRequired,
    rootId: React.PropTypes.string.isRequired
};
