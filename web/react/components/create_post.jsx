// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
const Client = require('../utils/client.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const ChannelStore = require('../stores/channel_store.jsx');
const PostStore = require('../stores/post_store.jsx');
const UserStore = require('../stores/user_store.jsx');
const SocketStore = require('../stores/socket_store.jsx');
const MsgTyping = require('./msg_typing.jsx');
const Textbox = require('./textbox.jsx');
const FileUpload = require('./file_upload.jsx');
const FilePreview = require('./file_preview.jsx');
const Utils = require('../utils/utils.jsx');

const Constants = require('../utils/constants.jsx');
const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

export default class CreatePost extends React.Component {
    constructor(props) {
        super(props);

        this.lastTime = 0;

        this.getCurrentDraft = this.getCurrentDraft.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.postMsgKeyPress = this.postMsgKeyPress.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.resizePostHolder = this.resizePostHolder.bind(this);
        this.handleUploadStart = this.handleUploadStart.bind(this);
        this.handleFileUploadComplete = this.handleFileUploadComplete.bind(this);
        this.handleUploadError = this.handleUploadError.bind(this);
        this.handleTextDrop = this.handleTextDrop.bind(this);
        this.removePreview = this.removePreview.bind(this);
        this.onChange = this.onChange.bind(this);
        this.getFileCount = this.getFileCount.bind(this);
        this.handleArrowUp = this.handleArrowUp.bind(this);

        PostStore.clearDraftUploads();

        const draft = this.getCurrentDraft();

        this.state = {
            channelId: ChannelStore.getCurrentId(),
            messageText: draft.messageText,
            uploadsInProgress: draft.uploadsInProgress,
            previews: draft.previews,
            submitting: false,
            initialText: draft.messageText
        };
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevState.previews.length !== this.state.previews.length) {
            this.resizePostHolder();
            return;
        }

        if (prevState.uploadsInProgress !== this.state.uploadsInProgress) {
            this.resizePostHolder();
            return;
        }
    }
    getCurrentDraft() {
        const draft = PostStore.getCurrentDraft();
        const safeDraft = {previews: [], messageText: '', uploadsInProgress: []};

        if (draft) {
            if (draft.message) {
                safeDraft.messageText = draft.message;
            }
            if (draft.previews) {
                safeDraft.previews = draft.previews;
            }
            if (draft.uploadsInProgress) {
                safeDraft.uploadsInProgress = draft.uploadsInProgress;
            }
        }

        return safeDraft;
    }
    handleSubmit(e) {
        e.preventDefault();

        if (this.state.uploadsInProgress.length > 0 || this.state.submitting) {
            return;
        }

        const post = {};
        post.filenames = [];
        post.message = this.state.messageText;

        if (post.message.trim().length === 0 && this.state.previews.length === 0) {
            return;
        }

        if (post.message.length > Constants.CHARACTER_LIMIT) {
            this.setState({postError: `Post length must be less than ${Constants.CHARACTER_LIMIT} characters.`});
            return;
        }

        this.setState({submitting: true, serverError: null});

        if (post.message.indexOf('/') === 0) {
            Client.executeCommand(
                this.state.channelId,
                post.message,
                false,
                (data) => {
                    PostStore.storeDraft(data.channel_id, null);
                    this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

                    if (data.goto_location.length > 0) {
                        window.location.href = data.goto_location;
                    }
                },
                (err) => {
                    const state = {};
                    state.serverError = err.message;
                    state.submitting = false;
                    this.setState(state);
                }
            );
        } else {
            post.channel_id = this.state.channelId;
            post.filenames = this.state.previews;

            const time = Utils.getTimestamp();
            const userId = UserStore.getCurrentId();
            post.pending_post_id = `${userId}:${time}`;
            post.user_id = userId;
            post.create_at = time;
            post.root_id = this.state.rootId;
            post.parent_id = this.state.parentId;

            const channel = ChannelStore.get(this.state.channelId);

            PostStore.storePendingPost(post);
            PostStore.storeDraft(channel.id, null);
            this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

            Client.createPost(post, channel,
                (data) => {
                    AsyncClient.getPosts();

                    const member = ChannelStore.getMember(channel.id);
                    member.msg_count = channel.total_msg_count;
                    member.last_viewed_at = Date.now();
                    ChannelStore.setChannelMember(member);

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_POST,
                        post: data
                    });
                },
                (err) => {
                    const state = {};

                    if (err.message === 'Invalid RootId parameter') {
                        if ($('#post_deleted').length > 0) {
                            $('#post_deleted').modal('show');
                        }
                        PostStore.removePendingPost(post.pending_post_id);
                    } else {
                        post.state = Constants.POST_FAILED;
                        PostStore.updatePendingPost(post);
                    }

                    state.submitting = false;
                    this.setState(state);
                }
            );
        }
    }
    postMsgKeyPress(e) {
        if (e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            ReactDOM.findDOMNode(this.refs.textbox).blur();
            this.handleSubmit(e);
        }

        const t = Date.now();
        if ((t - this.lastTime) > 5000) {
            SocketStore.sendMessage({channel_id: this.state.channelId, action: 'typing', props: {parent_id: ''}, state: {}});
            this.lastTime = t;
        }
    }
    handleUserInput(messageText) {
        this.setState({messageText});

        const draft = PostStore.getCurrentDraft();
        draft.message = messageText;
        PostStore.storeCurrentDraft(draft);
    }
    resizePostHolder() {
        const height = $(window).height() - $(ReactDOM.findDOMNode(this.refs.topDiv)).height() - 50;
        $('.post-list-holder-by-time').css('height', `${height}px`);
        $(window).trigger('resize');
        if ($(window).width() > 960) {
            $('#post_textbox').focus();
        }
    }
    handleUploadStart(clientIds, channelId) {
        const draft = PostStore.getDraft(channelId);

        draft.uploadsInProgress = draft.uploadsInProgress.concat(clientIds);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress});
    }
    handleFileUploadComplete(filenames, clientIds, channelId) {
        const draft = PostStore.getDraft(channelId);

        // remove each finished file from uploads
        for (let i = 0; i < clientIds.length; i++) {
            const index = draft.uploadsInProgress.indexOf(clientIds[i]);

            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }
        }

        draft.previews = draft.previews.concat(filenames);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress, previews: draft.previews});
    }
    handleUploadError(err, clientId) {
        if (clientId === -1) {
            this.setState({serverError: err});
        } else {
            const draft = PostStore.getDraft(this.state.channelId);

            const index = draft.uploadsInProgress.indexOf(clientId);
            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }

            PostStore.storeDraft(this.state.channelId, draft);

            this.setState({uploadsInProgress: draft.uploadsInProgress, serverError: err});
        }
    }
    handleTextDrop(text) {
        const newText = this.state.messageText + text;
        this.handleUserInput(newText);
        Utils.setCaretPosition(ReactDOM.findDOMNode(this.refs.textbox.refs.message), newText.length);
    }
    removePreview(id) {
        const previews = Object.assign([], this.state.previews);
        const uploadsInProgress = this.state.uploadsInProgress;

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

        const draft = PostStore.getCurrentDraft();
        draft.previews = previews;
        draft.uploadsInProgress = uploadsInProgress;
        PostStore.storeCurrentDraft(draft);

        this.setState({previews, uploadsInProgress});
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        this.resizePostHolder();
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
    }
    onChange() {
        const channelId = ChannelStore.getCurrentId();
        if (this.state.channelId !== channelId) {
            const draft = this.getCurrentDraft();

            this.setState({channelId, messageText: draft.messageText, initialText: draft.messageText, submitting: false, serverError: null, postError: null, previews: draft.previews, uploadsInProgress: draft.uploadsInProgress});
        }
    }
    getFileCount(channelId) {
        if (channelId === this.state.channelId) {
            return this.state.previews.length + this.state.uploadsInProgress.length;
        }

        const draft = PostStore.getDraft(channelId);
        return draft.previews.length + draft.uploadsInProgress.length;
    }
    handleArrowUp(e) {
        if (e.keyCode === KeyCodes.UP && this.state.messageText === '') {
            e.preventDefault();

            const channelId = ChannelStore.getCurrentId();
            const lastPost = PostStore.getCurrentUsersLatestPost(channelId);
            var type = (lastPost.root_id && lastPost.root_id.length > 0) ? 'Comment' : 'Post';

            AppDispatcher.handleViewAction({
                type: ActionTypes.RECIEVED_EDIT_POST,
                refoucsId: '#post_textbox',
                title: type,
                message: lastPost.message,
                lastPostId: lastPost.id,
                channelId: lastPost.channel_id
            });
        }
    }
    render() {
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

        return (
            <form
                id='create_post'
                ref='topDiv'
                role='form'
                onSubmit={this.handleSubmit}
            >
                <div className='post-create'>
                    <div className='post-create-body'>
                        <div className='post-body__cell'>
                            <Textbox
                                onUserInput={this.handleUserInput}
                                onKeyPress={this.postMsgKeyPress}
                                onKeyDown={this.handleArrowUp}
                                onHeightChange={this.resizePostHolder}
                                messageText={this.state.messageText}
                                createMessage='Write a message...'
                                channelId={this.state.channelId}
                                id='post_textbox'
                                ref='textbox'
                            />
                            <FileUpload
                                ref='fileUpload'
                                getFileCount={this.getFileCount}
                                onUploadStart={this.handleUploadStart}
                                onFileUpload={this.handleFileUploadComplete}
                                onUploadError={this.handleUploadError}
                                onTextDrop={this.handleTextDrop}
                                postType='post'
                                channelId=''
                            />
                        </div>
                        <a
                            className='send-button theme'
                            onClick={this.handleSubmit}
                        >
                            <i className='fa fa-paper-plane' />
                        </a>
                    </div>
                    <div className={postFooterClassName}>
                        {postError}
                        {serverError}
                        {preview}
                        <MsgTyping
                            channelId={this.state.channelId}
                            parentId=''
                        />
                    </div>
                </div>
            </form>
        );
    }
}
