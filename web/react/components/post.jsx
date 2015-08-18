// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PostHeader = require('./post_header.jsx');
var PostBody = require('./post_body.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var UserStore = require('../stores/user_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var ActionTypes = Constants.ActionTypes;

var PostInfo = require('./post_info.jsx');

module.exports = React.createClass({
    displayName: "Post",
    handleCommentClick: function(e) {
        e.preventDefault();

        var data = {};
        data.order = [this.props.post.id];
        data.posts = this.props.posts;

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POST_SELECTED,
            post_list: data
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH,
            results: null
        });
    },
    forceUpdateInfo: function() {
        this.refs.info.forceUpdate();
        this.refs.header.forceUpdate();
    },
    retryPost: function(e) {
        e.preventDefault();

        var post = this.props.post;
        client.createPost(post, post.channel_id,
            function(data) {
                AsyncClient.getPosts(true);

                var channel = ChannelStore.get(post.channel_id);
                var member = ChannelStore.getMember(post.channel_id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = (new Date).getTime();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_POST,
                    post: data
                });
            }.bind(this),
            function(err) {
                post.state = Constants.POST_FAILED;
                PostStore.updatePendingPost(post);
                this.forceUpdate();
            }.bind(this)
        );

        post.state = Constants.POST_LOADING;
        PostStore.updatePendingPost(post);
        this.forceUpdate();
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var post = this.props.post;
        var parentPost = this.props.parentPost;
        var posts = this.props.posts;

        var type = 'Post';
        if (post.root_id && post.root_id.length > 0) {
            type = 'Comment';
        }

        var commentCount = 0;
        var commentRootId = parentPost ? post.root_id : post.id;
        for (var postId in posts) {
            if (posts[postId].root_id == commentRootId) {
                commentCount += 1;
            }
        }

        var error = this.state.error ? <div className='form-group has-error'><label className='control-label'>{ this.state.error }</label></div> : null;

        var rootUser =  this.props.sameRoot ? "same--root" : "other--root";

        var postType = "";
        if (type != "Post"){
            postType = "post--comment";
        }

        var currentUserCss = "";
        if (UserStore.getCurrentId() === post.user_id) {
            currentUserCss = "current--user";
        }

        var timestamp = UserStore.getCurrentUser().update_at;

        return (
            <div>
                <div id={post.id} className={"post " + this.props.sameUser + " " + rootUser + " " + postType + " " + currentUserCss}>
                    { !this.props.hideProfilePic ?
                    <div className="post-profile-img__container">
                        <img className="post-profile-img" src={"/api/v1/users/" + post.user_id + "/image?time=" + timestamp} height="36" width="36" />
                    </div>
                    : null }
                    <div className="post__content">
                        <PostHeader ref="header" post={post} sameRoot={this.props.sameRoot} commentCount={commentCount} handleCommentClick={this.handleCommentClick} isLastComment={this.props.isLastComment} />
                        <PostBody post={post} sameRoot={this.props.sameRoot} parentPost={parentPost} posts={posts} handleCommentClick={this.handleCommentClick} retryPost={this.retryPost} />
                        <PostInfo ref="info" post={post} sameRoot={this.props.sameRoot} commentCount={commentCount} handleCommentClick={this.handleCommentClick} allowReply="true" />
                    </div>
                </div>
            </div>
        );
    }
});
