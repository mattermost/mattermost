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

        if (this.state.uploadsInProgress > 0) return;

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
            draft['uploadsInProgress'] = 0;
        }
        draft['message'] = messageText;
        PostStore.storeCurrentDraft(draft);
    },
    resizePostHolder: function() {
        var height = $(window).height() - $(this.refs.topDiv.getDOMNode()).height() - $('#error_bar').outerHeight() - 50;
        $(".post-list-holder-by-time").css("height", height + "px");
        $(window).trigger('resize');
    },
    handleFileUpload: function(newPreviews, channel_id) {
        var draft = PostStore.getDraft(channel_id);
        if (!draft) {
            draft = {}
            draft['message'] = '';
            draft['uploadsInProgress'] = 0;
            draft['previews'] = [];
        }

        if (channel_id === this.state.channel_id) {
            var num = this.state.uploadsInProgress;
            var oldPreviews = this.state.previews;
            var previews = oldPreviews.concat(newPreviews);

            draft['previews'] = previews;
            draft['uploadsInProgress'] = num-1;
            PostStore.storeCurrentDraft(draft);

            this.setState({previews: previews, uploadsInProgress:num-1});
        } else {
            draft['previews'] = draft['previews'].concat(newPreviews);
            draft['uploadsInProgress'] = draft['uploadsInProgress'] > 0 ? draft['uploadsInProgress'] - 1 : 0;
            PostStore.storeDraft(channel_id, draft);
        }
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
            draft['uploadsInProgress'] = 0;
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
            var uploadsInProgress = 0;
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
        return { channel_id: ChannelStore.getCurrentId(), messageText: messageText, uploadsInProgress: 0, previews: previews, submitting: false, initialText: messageText };
    },
    setUploads: function(val) {
        var oldInProgress = this.state.uploadsInProgress
        var newInProgress = oldInProgress + val;

        if (newInProgress + this.state.previews.length > Constants.MAX_UPLOAD_FILES) {
            newInProgress = Constants.MAX_UPLOAD_FILES - this.state.previews.length;
            this.setState({limit_error: "Uploads limited to " + Constants.MAX_UPLOAD_FILES + " files maximum. Please use additional posts for more files."});
        } else {
            this.setState({limit_error: null});
        }

        var numToUpload = newInProgress - oldInProgress;
        if (numToUpload <= 0) return 0;

        var draft = PostStore.getCurrentDraft();
        if (!draft) {
            draft = {}
            draft['message'] = '';
            draft['previews'] = [];
        }
        draft['uploadsInProgress'] = newInProgress;
        PostStore.storeCurrentDraft(draft);
        this.setState({uploadsInProgress: newInProgress});

        return numToUpload;
    },
    render: function() {
        var useMarkdown = config.AllowMarkdown;

        var server_error = this.state.server_error ? <div className='has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;
        var post_error = this.state.post_error ? <label className='control-label'>{this.state.post_error}</label> : null;
        var limit_error = this.state.limit_error ? <div className='has-error'><label className='control-label'>{this.state.limit_error}</label></div> : null;

        var preview = <div/>;
        if (this.state.previews.length > 0 || this.state.uploadsInProgress > 0) {
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
                            setUploads={this.setUploads}
                            onFileUpload={this.handleFileUpload}
                            onUploadError={this.handleUploadError} />
                    </div>
                    <div className={post_error ? 'post-create-footer has-error' : 'post-create-footer'}>
                        { post_error }
                        { server_error }
                        { limit_error }
                        { preview }
                        <MsgTyping channelId={this.state.channel_id} parentId=""/>
                        { this.state.messageText.split(" ").length > 1 && useMarkdown ?
                        <div className={"post-markdown-info"}>_<em>italics</em>_ **<strong>bold</strong>** **<strong>bold and _<em>italic</em>_ words</strong>** <a href="https://help.github.com/articles/markdown-basics/">Click here for more...</a></div>
                        :
                        <div><br /></div>
                        }
                    </div>
                </div>
            </form>
        );
    }
});
