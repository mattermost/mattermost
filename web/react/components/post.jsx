// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PostHeader = require('./post_header.jsx');
var PostBody = require('./post_body.jsx');
var PostInfo = require('./post_info.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var UserStore = require('../stores/user_store.jsx');
var ActionTypes = Constants.ActionTypes;

module.exports = React.createClass({
    displayName: "Post",
    componentDidMount: function() {
        $('.modal').on('show.bs.modal', function () {
            $('.modal-body').css('overflow-y', 'auto');
            $('.modal-body').css('max-height', $(window).height() * 0.7);
        });
    },
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
    getInitialState: function() {
        return { };
    },
    render: function() {
        var post = this.props.post;
        var parentPost = this.props.parentPost;
        var posts = this.props.posts;

        var type = "Post"
        if (post.root_id.length > 0) {
            type = "Comment"
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
                        <PostHeader post={post} sameRoot={this.props.sameRoot} commentCount={commentCount} handleCommentClick={this.handleCommentClick} isLastComment={this.props.isLastComment} />
                        <PostBody post={post} sameRoot={this.props.sameRoot} parentPost={parentPost} posts={posts} handleCommentClick={this.handleCommentClick} />
                        <PostInfo ref="info" post={post} sameRoot={this.props.sameRoot} commentCount={commentCount} handleCommentClick={this.handleCommentClick} allowReply="true" />
                    </div>
                </div>
            </div>
        );
    }
});
