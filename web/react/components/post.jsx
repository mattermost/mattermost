// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
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
var utils = require('../utils/utils.jsx');

var PostInfo = require('./post_info.jsx');

export default class Post extends React.Component {
    constructor(props) {
        super(props);

        this.handleCommentClick = this.handleCommentClick.bind(this);
        this.forceUpdateInfo = this.forceUpdateInfo.bind(this);
        this.retryPost = this.retryPost.bind(this);

        this.state = {};
    }
    handleCommentClick(e) {
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
    }
    forceUpdateInfo() {
        this.refs.info.forceUpdate();
        this.refs.header.forceUpdate();
    }
    retryPost(e) {
        e.preventDefault();

        var post = this.props.post;
        client.createPost(post, post.channel_id,
            (data) => {
                AsyncClient.getPosts();

                var channel = ChannelStore.get(post.channel_id);
                var member = ChannelStore.getMember(post.channel_id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = utils.getTimestamp();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_POST,
                    post: data
                });
            },
            () => {
                post.state = Constants.POST_FAILED;
                PostStore.updatePendingPost(post);
                this.forceUpdate();
            }
        );

        post.state = Constants.POST_LOADING;
        PostStore.updatePendingPost(post);
        this.forceUpdate();
    }
    shouldComponentUpdate(nextProps) {
        if (!utils.areStatesEqual(nextProps.post, this.props.post)) {
            return true;
        }

        if (nextProps.sameRoot !== this.props.sameRoot) {
            return true;
        }

        if (nextProps.sameUser !== this.props.sameUser) {
            return true;
        }

        if (this.getCommentCount(nextProps) !== this.getCommentCount(this.props)) {
            return true;
        }

        return false;
    }
    getCommentCount(props) {
        const post = props.post;
        const parentPost = props.parentPost;
        const posts = props.posts;

        let commentCount = 0;
        let commentRootId;
        if (parentPost) {
            commentRootId = post.root_id;
        } else {
            commentRootId = post.id;
        }
        for (let postId in posts) {
            if (posts[postId].root_id === commentRootId) {
                commentCount += 1;
            }
        }

        return commentCount;
    }
    render() {
        var post = this.props.post;
        var parentPost = this.props.parentPost;
        var posts = this.props.posts;

        var type = 'Post';
        if (post.root_id && post.root_id.length > 0) {
            type = 'Comment';
        }

        const commentCount = this.getCommentCount(this.props);

        var rootUser;
        if (this.props.sameRoot) {
            rootUser = 'same--root';
        } else {
            rootUser = 'other--root';
        }

        var postType = '';
        if (type !== 'Post') {
            postType = 'post--comment';
        }

        var currentUserCss = '';
        if (UserStore.getCurrentId() === post.user_id) {
            currentUserCss = 'current--user';
        }

        var userProfile = UserStore.getProfile(post.user_id);

        var timestamp = UserStore.getCurrentUser().update_at;
        if (userProfile) {
            timestamp = userProfile.update_at;
        }

        var sameUserClass = '';
        if (this.props.sameUser) {
            sameUserClass = 'same--user';
        }

        var profilePic = null;
        if (!this.props.hideProfilePic) {
            let src = '/api/v1/users/' + post.user_id + '/image?time=' + timestamp;
            if (post.props && post.props.from_webhook && global.window.config.EnablePostIconOverride === 'true') {
                if (post.props.override_icon_url) {
                    src = post.props.override_icon_url;
                }
            }

            profilePic = (
                <div className='post-profile-img__container'>
                    <img
                        className='post-profile-img'
                        src={src}
                        height='36'
                        width='36'
                    />
                </div>
            );
        }

        return (
            <div>
                <div
                    id={'post_' + post.id}
                    className={'post ' + sameUserClass + ' ' + rootUser + ' ' + postType + ' ' + currentUserCss}
                >
                    {profilePic}
                    <div className='post__content'>
                        <PostHeader
                            ref='header'
                            post={post}
                            sameRoot={this.props.sameRoot}
                            commentCount={commentCount}
                            handleCommentClick={this.handleCommentClick}
                            isLastComment={this.props.isLastComment}
                        />
                        <PostBody
                            post={post}
                            sameRoot={this.props.sameRoot}
                            parentPost={parentPost}
                            posts={posts}
                            handleCommentClick={this.handleCommentClick}
                            retryPost={this.retryPost}
                        />
                        <PostInfo
                            ref='info'
                            post={post}
                            sameRoot={this.props.sameRoot}
                            commentCount={commentCount}
                            handleCommentClick={this.handleCommentClick}
                            allowReply='true'
                        />
                    </div>
                </div>
            </div>
        );
    }
}

Post.propTypes = {
    post: React.PropTypes.object,
    posts: React.PropTypes.object,
    parentPost: React.PropTypes.object,
    sameUser: React.PropTypes.bool,
    sameRoot: React.PropTypes.bool,
    hideProfilePic: React.PropTypes.bool,
    isLastComment: React.PropTypes.bool
};
