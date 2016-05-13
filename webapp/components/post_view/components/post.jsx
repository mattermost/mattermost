// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostHeader from './post_header.jsx';
import PostBody from './post_body.jsx';

import PostStore from 'stores/post_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import Client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import React from 'react';

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

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_POST_SELECTED,
            postId: Utils.getRootId(this.props.post)
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH,
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
        Client.createPost(post,
            (data) => {
                AsyncClient.getPosts();

                var channel = ChannelStore.get(post.channel_id);
                var member = ChannelStore.getMember(post.channel_id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = Utils.getTimestamp();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POST,
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
        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }

        if (nextProps.sameRoot !== this.props.sameRoot) {
            return true;
        }

        if (nextProps.sameUser !== this.props.sameUser) {
            return true;
        }

        if (nextProps.displayNameType !== this.props.displayNameType) {
            return true;
        }

        if (nextProps.commentCount !== this.props.commentCount) {
            return true;
        }

        if (nextProps.shouldHighlight !== this.props.shouldHighlight) {
            return true;
        }

        if (nextProps.center !== this.props.center) {
            return true;
        }

        if (nextProps.compactDisplay !== this.props.compactDisplay) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.user, this.props.user)) {
            return true;
        }

        return false;
    }
    render() {
        const post = this.props.post;
        const parentPost = this.props.parentPost;
        const mattermostLogo = Constants.MATTERMOST_ICON_SVG;

        if (!post.props) {
            post.props = {};
        }

        let type = 'Post';
        if (post.root_id && post.root_id.length > 0) {
            type = 'Comment';
        }

        const commentCount = this.props.commentCount;

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
        if (this.props.currentUser.id === post.user_id && !post.props.from_webhook && !PostUtils.isSystemMessage(post)) {
            currentUserCss = 'current--user';
        }

        let timestamp = 0;
        if (!this.props.user || this.props.user.update_at == null) {
            timestamp = this.props.currentUser.update_at;
        } else {
            timestamp = this.props.user.update_at;
        }

        let sameUserClass = '';
        if (this.props.sameUser) {
            sameUserClass = 'same--user';
        }

        let shouldHighlightClass = '';
        if (this.props.shouldHighlight) {
            shouldHighlightClass = 'post--highlight';
        }

        let systemMessageClass = '';
        if (PostUtils.isSystemMessage(post)) {
            systemMessageClass = 'post--system';
        }

        let profilePic = null;
        if (!this.props.hideProfilePic || this.props.compactDisplay) {
            profilePic = (
                <img
                    src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                    height='36'
                    width='36'
                />
            );

            if (PostUtils.isSystemMessage(post)) {
                profilePic = (
                    <span
                        className='icon'
                        dangerouslySetInnerHTML={{__html: mattermostLogo}}
                    />
                );
            }
        }

        let centerClass = '';
        if (this.props.center) {
            centerClass = 'center';
        }

        let compactClass = '';
        if (this.props.compactDisplay) {
            compactClass = 'post--compact';
        }

        return (
            <div>
                <div
                    id={'post_' + post.id}
                    className={'post ' + sameUserClass + ' ' + compactClass + ' ' + rootUser + ' ' + postType + ' ' + currentUserCss + ' ' + shouldHighlightClass + ' ' + systemMessageClass}
                >
                    <div className={'post__content ' + centerClass}>
                        <div className='post__img'>{profilePic}</div>
                        <div>
                            <PostHeader
                                ref='header'
                                post={post}
                                sameRoot={this.props.sameRoot}
                                commentCount={commentCount}
                                handleCommentClick={this.handleCommentClick}
                                isLastComment={this.props.isLastComment}
                                sameUser={this.props.sameUser}
                                user={this.props.user}
                                currentUser={this.props.currentUser}
                                compactDisplay={this.props.compactDisplay}
                            />
                            <PostBody
                                post={post}
                                sameRoot={this.props.sameRoot}
                                parentPost={parentPost}
                                handleCommentClick={this.handleCommentClick}
                                retryPost={this.retryPost}
                                compactDisplay={this.props.compactDisplay}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

Post.propTypes = {
    post: React.PropTypes.object.isRequired,
    parentPost: React.PropTypes.object,
    user: React.PropTypes.object,
    sameUser: React.PropTypes.bool,
    sameRoot: React.PropTypes.bool,
    hideProfilePic: React.PropTypes.bool,
    isLastComment: React.PropTypes.bool,
    shouldHighlight: React.PropTypes.bool,
    displayNameType: React.PropTypes.string,
    hasProfiles: React.PropTypes.bool,
    currentUser: React.PropTypes.object.isRequired,
    center: React.PropTypes.bool,
    compactDisplay: React.PropTypes.bool,
    commentCount: React.PropTypes.number
};
