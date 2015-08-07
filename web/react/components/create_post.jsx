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

        if (this.state.uploadsInProgress.length > 0) return;

        if (this.state.submitting) return;

        var post = {};
        post.filenames = [];

        post.message = this.state.messageText;

        if (post.message.trim().length === 0 && this.state.previews.length === 0) {
            return;
        }

        if (post.message.length > Constants.CHARACTER_LIMIT) {
            this.setState({ post_error: 'Post length must be less than '+Constants.CHARACTER_LIMIT+' characters.' });
            return;
        }

        this.setState({ submitting: true, limit_error: null });

        var user_id = UserStore.getCurrentId();

        if (post.message.indexOf("/") == 0) {
            client.executeCommand(
                this.state.channel_id,
                post.message,
                false,
                function(data) {
                    PostStore.storeDraft(data.channel_id, null);
                    this.setState({ messageText: '', submitting: false, post_error: null, previews: [], server_error: null, limit_error: null });

                    if (data.goto_location.length > 0) {
                        window.location.href = data.goto_location;
                    }
                }.bind(this),
                function(err){
                    var state = {}
                    state.server_error = err.message;
                    state.submitting = false;
                    this.setState(state);
                }.bind(this)
            );
        } else {
            post.channel_id = this.state.channel_id;
            post.filenames = this.state.previews;

            client.createPost(post, ChannelStore.getCurrent(),
                function(data) {
                    PostStore.storeDraft(data.channel_id, null);
                    this.setState({ messageText: '', submitting: false, post_error: null, previews: [], server_error: null, limit_error: null });
                    this.resizePostHolder();
                    AsyncClient.getPosts(true);

                    var channel = ChannelStore.get(this.state.channel_id);
                    var member = ChannelStore.getMember(this.state.channel_id);
                    member.msg_count = channel.total_msg_count;
                    member.last_viewed_at = (new Date).getTime();
                    ChannelStore.setChannelMember(member);

                }.bind(this),
                function(err) {
                    var state = {}
                    state.server_error = err.message;

                    state.submitting = false;
                    this.setState(state);
                }.bind(this)
            );
        }

        $(".post-list-holder-by-time").perfectScrollbar('update');
    },
    componentDidUpdate: function() {
        this.resizePostHolder();
    },
    postMsgKeyPress: function(e) {
        if (e.which == 13 && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.refs.textbox.getDOMNode().blur();
            this.handleSubmit(e);
        }

        var t = new Date().getTime();
        if ((t - this.lastTime) > 5000) {
            SocketStore.sendMessage({channel_id: this.state.channel_id, action: "typing", props: {"parent_id": ""}, state: {} });
            this.lastTime = t;
        }
    },
    handleUserInput: function(messageText) {
        this.resizePostHolder();
        this.setState({messageText: messageText});

        var draft = PostStore.getCurrentDraft();
        if (!draft) {
            draft = {}
            draft['previews'] = [];
            draft['uploadsInProgress'] = [];
        }
        draft['message'] = messageText;
        PostStore.storeCurrentDraft(draft);
    },
    resizePostHolder: function() {
        var height = $(window).height() - $(this.refs.topDiv.getDOMNode()).height() - $('#error_bar').outerHeight() - 50;
        $(".post-list-holder-by-time").css("height", height + "px");
        $(window).trigger('resize');
    },
    handleUploadStart: function(filenames, channel_id) {
        var draft = PostStore.getDraft(channel_id);
        if (!draft) {
            draft = {};
            draft['message'] = '';
            draft['uploadsInProgress'] = [];
            draft['previews'] = [];
        }

        draft['uploadsInProgress'] = draft['uploadsInProgress'].concat(filenames);
        PostStore.storeDraft(channel_id, draft);

        this.setState({uploadsInProgress: draft['uploadsInProgress']});
    },
    handleFileUploadComplete: function(filenames, channel_id) {
        var draft = PostStore.getDraft(channel_id);
        if (!draft) {
            draft = {};
            draft['message'] = '';
            draft['uploadsInProgress'] = [];
            draft['previews'] = [];
        }

        // remove each finished file from uploads
        for (var i = 0; i < filenames.length; i++) {
            var filename = filenames[i];

            // filenames returned by the server include a path while stored uploads only have the actual file name
            var index = -1;
            for (var j = 0; j < draft['uploadsInProgress'].length; j++) {
                var upload = draft['uploadsInProgress'][j];
                if (upload.indexOf(filename, upload.length - filename.length)) {
                    index = j;
                    break;
                }
            }

            if (index != -1) {
                draft['uploadsInProgress'].splice(index, 1);
            }
        }

        draft['previews'] = draft['previews'].concat(filenames);
        PostStore.storeDraft(channel_id, draft);

        this.setState({uploadsInProgress: draft['uploadsInProgress'], previews: draft['previews']});
    },
    handleUploadError: function(err) {
        this.setState({ server_error: err });
    },
    removePreview: function(filename) {
        var previews = this.state.previews;
        for (var i = 0; i < previews.length; i++) {
            if (previews[i] === filename) {
                previews.splice(i, 1);
                break;
            }
        }
        var draft = PostStore.getCurrentDraft();
        if (!draft) {
            draft = {}
            draft['message'] = '';
            draft['uploadsInProgress'] = [];
        }
        draft['previews'] = previews;
        PostStore.storeCurrentDraft(draft);
        this.setState({previews: previews});
    },
    componentDidMount: function() {
        ChannelStore.addChangeListener(this._onChange);
        this.resizePostHolder();
    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        var channel_id = ChannelStore.getCurrentId();
        if (this.state.channel_id != channel_id) {
            var draft = PostStore.getCurrentDraft();
            var previews = [];
            var messageText = '';
            var uploadsInProgress = [];
            if (draft) {
                previews = draft['previews'];
                messageText = draft['message'];
                uploadsInProgress = draft['uploadsInProgress'];
            }
            this.setState({ channel_id: channel_id, messageText: messageText, initialText: messageText, submitting: false, limit_error: null, server_error: null, post_error: null, previews: previews, uploadsInProgress: uploadsInProgress });
        }
    },
    getInitialState: function() {
        PostStore.clearDraftUploads();

        var draft = PostStore.getCurrentDraft();
        var previews = [];
        var messageText = '';
        if (draft) {
            previews = draft['previews'];
            messageText = draft['message'];
        }
        return { channel_id: ChannelStore.getCurrentId(), messageText: messageText, uploadsInProgress: [], previews: previews, submitting: false, initialText: messageText };
    },
    getFileCount: function(channel_id) {
        if (channel_id === this.state.channel_id) {
            return this.state.previews.length + this.state.uploadsInProgress.length;
        } else {
            var draft = PostStore.getDraft(channel_id);

            if (draft) {
                return draft['previews'].length + draft['uploadsInProgress'].length;
            } else {
                return 0;
            }
        }
    },
    render: function() {
        var server_error = this.state.server_error ? <div className='has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;
        var post_error = this.state.post_error ? <label className='control-label'>{this.state.post_error}</label> : null;

        var preview = <div/>;
        if (this.state.previews.length > 0 || this.state.uploadsInProgress.length > 0) {
            preview = (
                <FilePreview
                    files={this.state.previews}
                    onRemove={this.removePreview}
                    uploadsInProgress={this.state.uploadsInProgress} />
            );
        }

        return (
            <form id="create_post" ref="topDiv" role="form" onSubmit={this.handleSubmit}>
                <div className="post-create">
                    <div className="post-create-body">
                        <Textbox
                            onUserInput={this.handleUserInput}
                            onKeyPress={this.postMsgKeyPress}
                            messageText={this.state.messageText}
                            createMessage="Write a message..."
                            channelId={this.state.channel_id}
                            id="post_textbox"
                            ref="textbox" />
                        <FileUpload
                            getFileCount={this.getFileCount}
                            onUploadStart={this.handleUploadStart}
                            onFileUpload={this.handleFileUploadComplete}
                            onUploadError={this.handleUploadError} />
                    </div>
                    <div className={post_error ? 'post-create-footer has-error' : 'post-create-footer'}>
                        { post_error }
                        { server_error }
                        { preview }
                        <MsgTyping channelId={this.state.channel_id} parentId=""/>
                    </div>
                </div>
            </form>
        );
    }
});
