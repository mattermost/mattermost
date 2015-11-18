// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostHeader from './post_header.jsx';
import PostBody from './post_body.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
import UserStore from '../stores/user_store.jsx';
import PostStore from '../stores/post_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import * as client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
var ActionTypes = Constants.ActionTypes;
import * as utils from '../utils/utils.jsx';

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
        if (!utils.areObjectsEqual(nextProps.post, this.props.post)) {
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
        for (const postId in posts) {
            if (posts[postId].root_id === commentRootId) {
                commentCount += 1;
            }
        }

        return commentCount;
    }
    render() {
        const post = this.props.post;
        const parentPost = this.props.parentPost;
        const posts = this.props.posts;

        if (!post.props) {
            post.props = {};
        }

        let type = 'Post';
        if (post.root_id && post.root_id.length > 0) {
            type = 'Comment';
        }

        const commentCount = this.getCommentCount(this.props);

        let rootUser;
        if (this.props.sameRoot) {
            rootUser = 'same--root';
        } else {
            rootUser = 'other--root';
        }

        let postType = '';
        if (type !== 'Post') {
            postType = 'post--comment';
        } else if (commentCount > 0) {
            postType = 'post--root';
        }

        let currentUserCss = '';
        if (UserStore.getCurrentId() === post.user_id && !post.props.from_webhook) {
            currentUserCss = 'current--user';
        }

        const userProfile = UserStore.getProfile(post.user_id);

        let timestamp = UserStore.getCurrentUser().update_at;
        if (userProfile) {
            timestamp = userProfile.update_at;
        }

        let sameUserClass = '';
        if (this.props.sameUser) {
            sameUserClass = 'same--user';
        }

        let shouldHighlightClass = '';
        if (this.props.shouldHighlight) {
            shouldHighlightClass = 'post--highlight';
        }

        let profilePic = null;
        if (!this.props.hideProfilePic) {
            let src = '/api/v1/users/' + post.user_id + '/image?time=' + timestamp + '&' + utils.getSessionIndex();
            if (post.props && post.props.from_webhook && global.window.mm_config.EnablePostIconOverride === 'true') {
                if (post.props.override_icon_url) {
                    src = post.props.override_icon_url;
                }
            }

            profilePic = (
                <img
                    src={src}
                    height='36'
                    width='36'
                />
            );
        }

        return (
            <div>
                <div
                    id={'post_' + post.id}
                    className={'post ' + sameUserClass + ' ' + rootUser + ' ' + postType + ' ' + currentUserCss + ' ' + shouldHighlightClass}
                >
                    <div className='post__content'>
                        <div className='post__img'>{profilePic}</div>
                        <div>
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
                        </div>
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
    isLastComment: React.PropTypes.bool,
    shouldHighlight: React.PropTypes.bool
};
