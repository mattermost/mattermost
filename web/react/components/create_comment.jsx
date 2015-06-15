// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var AsyncClient =require('../utils/async_client.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var Textbox = require('./textbox.jsx');
var MsgTyping = require('./msg_typing.jsx');
var FileUpload = require('./file_upload.jsx');
var FilePreview = require('./file_preview.jsx');

var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    lastTime: 0,
    handleSubmit: function(e) {
        e.preventDefault();

        if (this.state.uploadsInProgress > 0) return;

        if (this.state.submitting) return;

        var post = {}
        post.filenames = [];

        post.message = this.state.messageText;
        if (post.message.trim().length === 0 && this.state.previews.length === 0) {
            return;
        }

        if (post.message.length > Constants.CHARACTER_LIMIT) {
            this.setState({ post_error: 'Comment length must be less than '+Constants.CHARACTER_LIMIT+' characters.' });
            return;
        }

        post.channel_id = this.props.channelId;
        post.root_id = this.props.rootId;
        post.parent_id = this.props.parentId;
        post.filenames = this.state.previews;

        this.setState({ submitting: true });

        client.createPost(post, ChannelStore.getCurrent(),
            function(data) {
                this.setState({ messageText: '', submitting: false, post_error: null });
                this.clearPreviews();
                AsyncClient.getPosts(true, this.props.channelId);

                var channel = ChannelStore.get(this.props.channelId);
                var member = ChannelStore.getMember(this.props.channelId);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = (new Date).getTime();
                ChannelStore.setChannelMember(member);

            }.bind(this),
            function(err) {
                var state = {}
                state.server_error = err.message;
                this.setState(state);
                if (err.message === "Invalid RootId parameter") {
                    if ($('#post_deleted').length > 0) $('#post_deleted').modal('show');
                }
            }.bind(this)
        );
    },
    commentMsgKeyPress: function(e) {
        if (e.which == 13 && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.refs.textbox.getDOMNode().blur();
            this.handleSubmit(e);
        }

        var t = new Date().getTime();
        if ((t - this.lastTime) > 5000) {
            SocketStore.sendMessage({channel_id: this.props.channelId, action: "typing", props: {"parent_id": this.props.rootId} });
            this.lastTime = t;
        }
    },
    handleUserInput: function(messageText) {
        $(".post-right__scroll").scrollTop($(".post-right__scroll")[0].scrollHeight);
        $(".post-right__scroll").perfectScrollbar('update');
        this.setState({messageText: messageText});
    },
    handleFileUpload: function(newPreviews) {
        $(".post-right__scroll").scrollTop($(".post-right__scroll")[0].scrollHeight);
        $(".post-right__scroll").perfectScrollbar('update');
        var oldPreviews = this.state.previews;
        var num = this.state.uploadsInProgress;
        this.setState({previews: oldPreviews.concat(newPreviews), uploadsInProgress:num-1});
    },
    handleUploadError: function(err) {
        this.setState({ server_error: err });
    },
    clearPreviews: function() {
        this.setState({previews: []});
    },
    removePreview: function(filename) {
        var previews = this.state.previews;
        for (var i = 0; i < previews.length; i++) {
            if (previews[i] === filename) {
                previews.splice(i, 1);
                break;
            }
        }
        this.setState({previews: previews});
    },
    getInitialState: function() {
        return { messageText: '', uploadsInProgress: 0, previews: [], submitting: false };
    },
    setUploads: function(val) {
        var num = this.state.uploadsInProgress + val;
        this.setState({uploadsInProgress: num});
    },
    render: function() {

        var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;
        var post_error = this.state.post_error ? <label className='control-label'>{this.state.post_error}</label> : null;

        var preview = <div/>;
        if (this.state.previews.length > 0 || this.state.uploadsInProgress > 0) {
            preview = (
                <FilePreview
                    files={this.state.previews}
                    onRemove={this.removePreview}
                    uploadsInProgress={this.state.uploadsInProgress} />
            );
        }
        var limit_previews = ""
        if (this.state.previews.length > 5) {
            limit_previews = <div className='has-error'><label className='control-label'>{ "Note: While all files will be available, only first five will show thumbnails." }</label></div>
        }
        if (this.state.previews.length > 20) {
            limit_previews = <div className='has-error'><label className='control-label'>{ "Note: Uploads limited to 20 files maximum. Please use additional posts for more files." }</label></div>
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className="post-create">
                    <div id={this.props.rootId} className="post-create-body comment-create-body">
                        <Textbox
                            onUserInput={this.handleUserInput}
                            onKeyPress={this.commentMsgKeyPress}
                            messageText={this.state.messageText}
                            createMessage="Create a comment..."
                            initialText=""
                            id="reply_textbox"
                            ref="textbox" />
                        <FileUpload
                            setUploads={this.setUploads}
                            onFileUpload={this.handleFileUpload}
                            onUploadError={this.handleUploadError} />
                    </div>
                    <MsgTyping channelId={this.props.channelId} parentId={this.props.rootId}  />
                    <div className={post_error ? 'has-error' : 'post-create-footer'}>
                        <input type="button" className="btn btn-primary comment-btn pull-right" value="Add Comment" onClick={this.handleSubmit} />
                        { post_error }
                        { server_error }
                        { limit_previews }
                    </div>
                </div>
                { preview }
            </form>
        );
    }
});
