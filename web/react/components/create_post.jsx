// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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

export default class CreatePost extends React.Component {
    constructor(props) {
        super(props);

        this.lastTime = 0;

        this.handleSubmit = this.handleSubmit.bind(this);
        this.postMsgKeyPress = this.postMsgKeyPress.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.resizePostHolder = this.resizePostHolder.bind(this);
        this.handleUploadStart = this.handleUploadStart.bind(this);
        this.handleFileUploadComplete = this.handleFileUploadComplete.bind(this);
        this.handleUploadError = this.handleUploadError.bind(this);
        this.removePreview = this.removePreview.bind(this);
        this.onChange = this.onChange.bind(this);
        this.getFileCount = this.getFileCount.bind(this);

        PostStore.clearDraftUploads();

        const draft = PostStore.getCurrentDraft();
        let previews = [];
        let messageText = '';
        let uploadsInProgress = [];
        if (draft && draft.previews && draft.message) {
            previews = draft.previews;
            messageText = draft.message;
            uploadsInProgress = draft.uploadsInProgress;
        }

        this.state = {
            channelId: ChannelStore.getCurrentId(),
            messageText: messageText,
            uploadsInProgress: uploadsInProgress,
            previews: previews,
            submitting: false,
            initialText: messageText
        };
    }
    handleSubmit(e) {
        e.preventDefault();

        if (this.state.uploadsInProgress.length > 0 || this.state.submitting) {
            return;
        }

        let post = {};
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
                function handleCommandSuccess(data) {
                    PostStore.storeDraft(data.channel_id, null);
                    this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

                    if (data.goto_location.length > 0) {
                        window.location.href = data.goto_location;
                    }
                }.bind(this),
                function handleCommandError(err) {
                    let state = {};
                    state.serverError = err.message;
                    state.submitting = false;
                    this.setState(state);
                }.bind(this)
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
                function handlePostSuccess(data) {
                    this.resizePostHolder();
                    AsyncClient.getPosts();

                    let member = ChannelStore.getMember(channel.id);
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
                }.bind(this)
            );
        }
    }
    componentDidUpdate() {
        this.resizePostHolder();
    }
    postMsgKeyPress(e) {
        if (e.which === 13 && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            React.findDOMNode(this.refs.textbox).blur();
            this.handleSubmit(e);
        }

        const t = Date.now();
        if ((t - this.lastTime) > 5000) {
            SocketStore.sendMessage({channel_id: this.state.channelId, action: 'typing', props: {parent_id: ''}, state: {}});
            this.lastTime = t;
        }
    }
    handleUserInput(messageText) {
        this.resizePostHolder();
        this.setState({messageText: messageText});

        let draft = PostStore.getCurrentDraft();
        draft.message = messageText;
        PostStore.storeCurrentDraft(draft);
    }
    resizePostHolder() {
        const height = $(window).height() - $(React.findDOMNode(this.refs.topDiv)).height() - $('#error_bar').outerHeight() - 50;
        $('.post-list-holder-by-time').css('height', `${height}px`);
        $(window).trigger('resize');
    }
    handleUploadStart(clientIds, channelId) {
        let draft = PostStore.getDraft(channelId);

        draft.uploadsInProgress = draft.uploadsInProgress.concat(clientIds);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress});
    }
    handleFileUploadComplete(filenames, clientIds, channelId) {
        let draft = PostStore.getDraft(channelId);

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
        if (clientId !== -1) {
            let draft = PostStore.getDraft(this.state.channelId);

            const index = draft.uploadsInProgress.indexOf(clientId);
            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }

            PostStore.storeDraft(this.state.channelId, draft);

            this.setState({uploadsInProgress: draft.uploadsInProgress, serverError: err});
        } else {
            this.setState({serverError: err});
        }
    }
    removePreview(id) {
        let previews = this.state.previews;
        let uploadsInProgress = this.state.uploadsInProgress;

        // id can either be the path of an uploaded file or the client id of an in progress upload
        let index = previews.indexOf(id);
        if (index !== -1) {
            previews.splice(index, 1);
        } else {
            index = uploadsInProgress.indexOf(id);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
                this.refs.fileUpload.cancelUpload(id);
            }
        }

        let draft = PostStore.getCurrentDraft();
        draft.previews = previews;
        draft.uploadsInProgress = uploadsInProgress;
        PostStore.storeCurrentDraft(draft);

        this.setState({previews: previews, uploadsInProgress: uploadsInProgress});
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
            let draft = PostStore.getCurrentDraft();

            let previews = [];
            let messageText = '';
            let uploadsInProgress = [];
            if (draft && draft.previews && draft.message) {
                previews = draft.previews;
                messageText = draft.message;
                uploadsInProgress = draft.uploadsInProgress;
            }

            this.setState({channelId: channelId, messageText: messageText, initialText: messageText, submitting: false, serverError: null, postError: null, previews: previews, uploadsInProgress: uploadsInProgress});
        }
    }
    getFileCount(channelId) {
        if (channelId === this.state.channelId) {
            return this.state.previews.length + this.state.uploadsInProgress.length;
        }

        const draft = PostStore.getDraft(channelId);
        return draft.previews.length + draft.uploadsInProgress.length;
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
                    uploadsInProgress={this.state.uploadsInProgress} />
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
                        <Textbox
                            onUserInput={this.handleUserInput}
                            onKeyPress={this.postMsgKeyPress}
                            messageText={this.state.messageText}
                            createMessage='Write a message...'
                            channelId={this.state.channelId}
                            id='post_textbox'
                            ref='textbox' />
                        <FileUpload
                            ref='fileUpload'
                            getFileCount={this.getFileCount}
                            onUploadStart={this.handleUploadStart}
                            onFileUpload={this.handleFileUploadComplete}
                            onUploadError={this.handleUploadError}
                            postType='post'
                            channelId='' />
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
