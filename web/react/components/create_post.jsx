// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var MsgTyping = require('./msg_typing.jsx');
var Textbox = require('./textbox.jsx');
var FileUpload = require('./file_upload.jsx');
var FilePreview = require('./file_preview.jsx');
var utils = require('../utils/utils.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

module.exports = React.createClass({
    lastTime: 0,
    handleSubmit: function(e) {
        e.preventDefault();

        if (this.state.uploadsInProgress.length > 0 || this.state.submitting) {
            return;
        }

        var post = {};
        post.filenames = [];
        post.message = this.state.messageText;

        if (post.message.trim().length === 0 && this.state.previews.length === 0) {
            return;
        }

        if (post.message.length > Constants.CHARACTER_LIMIT) {
            this.setState({postError: 'Post length must be less than ' + Constants.CHARACTER_LIMIT + ' characters.'});
            return;
        }

        this.setState({submitting: true, serverError: null});

        if (post.message.indexOf('/') === 0) {
            client.executeCommand(
                this.state.channelId,
                post.message,
                false,
                function(data) {
                    PostStore.storeDraft(data.channel_id, null);
                    this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

                    if (data.goto_location.length > 0) {
                        window.location.href = data.goto_location;
                    }
                }.bind(this),
                function(err) {
                    var state = {};
                    state.serverError = err.message;
                    state.submitting = false;
                    this.setState(state);
                }.bind(this)
            );
        } else {
            post.channel_id = this.state.channelId;
            post.filenames = this.state.previews;

            var time = utils.getTimestamp();
            var userId = UserStore.getCurrentId();
            post.pending_post_id = userId + ':' + time;
            post.user_id = userId;
            post.create_at = time;
            post.root_id = this.state.rootId;
            post.parent_id = this.state.parentId;

            var channel = ChannelStore.get(this.state.channelId);

            PostStore.storePendingPost(post);
            PostStore.storeDraft(channel.id, null);
            this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

            client.createPost(post, channel,
                function(data) {
                    this.resizePostHolder();
                    AsyncClient.getPosts(true);

                    var member = ChannelStore.getMember(channel.id);
                    member.msg_count = channel.total_msg_count;
                    member.last_viewed_at = Date.now();
                    ChannelStore.setChannelMember(member);

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_POST,
                        post: data
                    });
                }.bind(this),
                function(err) {
                    var state = {};

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

        $('.post-list-holder-by-time').perfectScrollbar('update');
    },
    componentDidUpdate: function() {
        this.resizePostHolder();
    },
    postMsgKeyPress: function(e) {
        if (e.which === 13 && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.refs.textbox.getDOMNode().blur();
            this.handleSubmit(e);
        }

        var t = Date.now();
        if ((t - this.lastTime) > 5000) {
            SocketStore.sendMessage({channel_id: this.state.channelId, action: 'typing', props: {'parent_id': ''}, state: {}});
            this.lastTime = t;
        }
    },
    handleUserInput: function(messageText) {
        this.resizePostHolder();
        this.setState({messageText: messageText});

        var draft = PostStore.getCurrentDraft();
        draft['message'] = messageText;
        PostStore.storeCurrentDraft(draft);
    },
    resizePostHolder: function() {
        var height = $(window).height() - $(this.refs.topDiv.getDOMNode()).height() - $('#error_bar').outerHeight() - 50;
        $('.post-list-holder-by-time').css('height', height + 'px');
        $(window).trigger('resize');
    },
    handleUploadStart: function(clientIds, channelId) {
        var draft = PostStore.getDraft(channelId);

        draft['uploadsInProgress'] = draft['uploadsInProgress'].concat(clientIds);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft['uploadsInProgress']});
    },
    handleFileUploadComplete: function(filenames, clientIds, channelId) {
        var draft = PostStore.getDraft(channelId);

        // remove each finished file from uploads
        for (var i = 0; i < clientIds.length; i++) {
            var index = draft['uploadsInProgress'].indexOf(clientIds[i]);

            if (index !== -1) {
                draft['uploadsInProgress'].splice(index, 1);
            }
        }

        draft['previews'] = draft['previews'].concat(filenames);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft['uploadsInProgress'], previews: draft['previews']});
    },
    handleUploadError: function(err, clientId) {
        if (clientId !== -1) {
            var draft = PostStore.getDraft(this.state.channelId);

            var index = draft['uploadsInProgress'].indexOf(clientId);
            if (index !== -1) {
                draft['uploadsInProgress'].splice(index, 1);
            }

            PostStore.storeDraft(this.state.channelId, draft);

            this.setState({uploadsInProgress: draft['uploadsInProgress'], serverError: err});
        } else {
            this.setState({serverError: err});
        }
    },
    removePreview: function(id) {
        var previews = this.state.previews;
        var uploadsInProgress = this.state.uploadsInProgress;

        // id can either be the path of an uploaded file or the client id of an in progress upload
        var index = previews.indexOf(id);
        if (index !== -1) {
            previews.splice(index, 1);
        } else {
            index = uploadsInProgress.indexOf(id);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
                this.refs.fileUpload.cancelUpload(id);
            }
        }

        var draft = PostStore.getCurrentDraft();
        draft['previews'] = previews;
        draft['uploadsInProgress'] = uploadsInProgress;
        PostStore.storeCurrentDraft(draft);

        this.setState({previews: previews, uploadsInProgress: uploadsInProgress});
    },
    componentDidMount: function() {
        ChannelStore.addChangeListener(this._onChange);
        this.resizePostHolder();
    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        var channelId = ChannelStore.getCurrentId();
        if (this.state.channelId !== channelId) {
            var draft = PostStore.getCurrentDraft();

            var previews = [];
            var messageText = '';
            var uploadsInProgress = 0;
            if (draft && draft.previews && draft.message) {
                previews = draft.previews;
                messageText = draft.message;
                uploadsInProgress = draft.uploadsInProgress;
            }

            this.setState({channelId: channelId, messageText: messageText, initialText: messageText, submitting: false, serverError: null, postError: null, previews: previews, uploadsInProgress: uploadsInProgress});
        }
    },
    getInitialState: function() {
        PostStore.clearDraftUploads();

        var draft = PostStore.getCurrentDraft();
        var previews = [];
        var messageText = '';
        var uploadsInProgress = 0;
        if (draft && draft.previews && draft.message) {
            previews = draft.previews;
            messageText = draft.message;
            uploadsInProgress = draft.uploadsInProgress;
        }

        return {channelId: ChannelStore.getCurrentId(), messageText: messageText, uploadsInProgress: uploadsInProgress, previews: previews, submitting: false, initialText: messageText};
    },
    getFileCount: function(channelId) {
        if (channelId === this.state.channelId) {
            return this.state.previews.length + this.state.uploadsInProgress.length;
        } else {
            var draft = PostStore.getDraft(channelId);

            return draft['previews'].length + draft['uploadsInProgress'].length;
        }
    },
    render: function() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='has-error'>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        var postError = null;
        if (this.state.postError) {
            postError = <label className='control-label'>{this.state.postError}</label>;
        }

        var preview = null;
        if (this.state.previews.length > 0 || this.state.uploadsInProgress.length > 0) {
            preview = (
                <FilePreview
                    files={this.state.previews}
                    onRemove={this.removePreview}
                    uploadsInProgress={this.state.uploadsInProgress} />
            );
        }

        var postFooterClassName = 'post-create-footer';
        if (postError) {
            postFooterClassName += ' has-error';
        }

        return (
            <form id='create_post' ref='topDiv' role='form' onSubmit={this.handleSubmit}>
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
                        <MsgTyping channelId={this.state.channelId} parentId=''/>
                    </div>
                </div>
            </form>
        );
    }
});
