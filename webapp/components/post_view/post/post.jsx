// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostHeader from 'components/post_view/post_header';
import PostBody from 'components/post_view/post_body';
import ProfilePicture from 'components/profile_picture.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import {Posts} from 'mattermost-redux/constants';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import React from 'react';
import PropTypes from 'prop-types';

export default class Post extends React.PureComponent {
    static propTypes = {

        /**
         * The post to render
         */
        post: PropTypes.object.isRequired,

        /**
         * The user who created the post
         */
        user: PropTypes.object,

        /**
         * The status of the poster
         */
        status: PropTypes.string,

        /**
         * The logged in user
         */
        currentUser: PropTypes.object.isRequired,

        /**
         * Set to center the post
         */
        center: PropTypes.bool,

        /**
         * Set to render post compactly
         */
        compactDisplay: PropTypes.bool,

        /**
         * Set to render a preview of the parent post above this reply
         */
        isFirstReply: PropTypes.bool,

        /**
         * Set to highlight the background of the post
         */
        highlight: PropTypes.bool,

        /**
         * Set to render this post as if it was attached to the previous post
         */
        consecutivePostByUser: PropTypes.bool,

        /**
         * Set if the previous post is a comment
         */
        previousPostIsComment: PropTypes.bool,

        /**
         * Set to render this comment as a mention
         */
        isCommentMention: PropTypes.bool,

        /**
         * The number of replies in the same thread as this post
         */
        replyCount: PropTypes.number,

        /**
         * Set to mark the poster as in a webrtc call
         */
        isBusy: PropTypes.bool,

        /**
         * The post count used for selenium tests
         */
        lastPostCount: PropTypes.number,

        /**
         * Function to get the post list HTML element
         */
        getPostList: PropTypes.func.isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            dropdownOpened: false
        };
    }

    handleCommentClick = (e) => {
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

    handleDropdownOpened = (opened) => {
        this.setState({
            dropdownOpened: opened
        });
    }

    forceUpdateInfo = () => {
        this.refs.info.forceUpdate();
        this.refs.header.forceUpdate();
    }

    getClassName = (post, isSystemMessage, fromWebhook) => {
        let className = 'post';

        if (post.failed || post.state === Posts.POST_DELETED) {
            className += ' post--hide-controls';
        }

        if (this.props.highlight) {
            className += ' post--highlight';
        }

        let rootUser = '';
        if (this.props.isFirstReply) {
            rootUser = 'other--root';
        } else if (!post.root_id && !this.props.previousPostIsComment && this.props.consecutivePostByUser) {
            rootUser = 'same--root';
        } else if (post.root_id) {
            rootUser = 'same--root';
        } else {
            rootUser = 'other--root';
        }

        let currentUserCss = '';
        if (this.props.currentUser.id === post.user_id && !fromWebhook && !isSystemMessage) {
            currentUserCss = 'current--user';
        }

        let sameUserClass = '';
        if (this.props.consecutivePostByUser) {
            sameUserClass = 'same--user';
        }

        let postType = '';
        if (post.root_id && post.root_id.length > 0) {
            postType = 'post--comment';
        } else if (this.props.replyCount > 0) {
            postType = 'post--root';
            sameUserClass = '';
            rootUser = '';
        }

        if (isSystemMessage) {
            className += ' post--system';
            sameUserClass = '';
            currentUserCss = '';
            postType = '';
            rootUser = '';
        }

        if (this.props.compactDisplay) {
            className += ' post--compact';
        }

        if (this.state.dropdownOpened) {
            className += ' post--hovered';
        }

        if (post.is_pinned) {
            className += ' post--pinned';
        }

        return className + ' ' + sameUserClass + ' ' + rootUser + ' ' + postType + ' ' + currentUserCss;
    }

    render() {
        const post = this.props.post;
        const mattermostLogo = Constants.MATTERMOST_ICON_SVG;

        const isSystemMessage = PostUtils.isSystemMessage(post);
        const fromWebhook = post.props && post.props.from_webhook === 'true';

        let status = this.props.status;
        if (fromWebhook) {
            status = null;
        }

        let profilePic = (
            <ProfilePicture
                src={PostUtils.getProfilePicSrcForPost(post, this.props.user)}
                status={status}
                user={this.props.user}
                isBusy={this.props.isBusy}
                hasMention={true}
            />
        );

        if (fromWebhook) {
            profilePic = (
                <ProfilePicture
                    src={PostUtils.getProfilePicSrcForPost(post, this.props.user)}
                />
            );
        } else if (PostUtils.isSystemMessage(post)) {
            profilePic = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: mattermostLogo}}
                />
            );
        }

        let centerClass = '';
        if (this.props.center) {
            centerClass = 'center';
        }

        if (this.props.compactDisplay) {
            if (fromWebhook) {
                profilePic = (
                    <ProfilePicture
                        src=''
                        status={status}
                        isBusy={this.props.isBusy}
                        user={this.props.user}
                    />
                );
            } else {
                profilePic = (
                    <ProfilePicture
                        src=''
                        status={status}
                    />
                );
            }
        }

        const profilePicContainer = (<div className='post__img'>{profilePic}</div>);

        return (
            <div
                ref={(div) => {
                    this.domNode = div;
                }}
            >
                <div
                    id={'post_' + post.id}
                    className={this.getClassName(this.props.post, isSystemMessage, fromWebhook)}
                >
                    <div className={'post__content ' + centerClass}>
                        {profilePicContainer}
                        <div>
                            <PostHeader
                                ref='header'
                                post={post}
                                handleCommentClick={this.handleCommentClick}
                                handleDropdownOpened={this.handleDropdownOpened}
                                user={this.props.user}
                                currentUser={this.props.currentUser}
                                compactDisplay={this.props.compactDisplay}
                                status={this.props.status}
                                isBusy={this.props.isBusy}
                                lastPostCount={this.props.lastPostCount}
                                replyCount={this.props.replyCount}
                                consecutivePostByUser={this.props.consecutivePostByUser}
                                getPostList={this.props.getPostList}
                            />
                            <PostBody
                                post={post}
                                handleCommentClick={this.handleCommentClick}
                                compactDisplay={this.props.compactDisplay}
                                lastPostCount={this.props.lastPostCount}
                                isCommentMention={this.props.isCommentMention}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
