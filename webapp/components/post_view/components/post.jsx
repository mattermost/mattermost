// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostHeader from './post_header.jsx';
import PostBody from './post_body.jsx';
import ProfilePicture from 'components/profile_picture.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import React from 'react';

export default class Post extends React.Component {
    constructor(props) {
        super(props);

        this.handleCommentClick = this.handleCommentClick.bind(this);
        this.handleDropdownOpened = this.handleDropdownOpened.bind(this);
        this.forceUpdateInfo = this.forceUpdateInfo.bind(this);
        this.handlePostClick = this.handlePostClick.bind(this);

        this.state = {
            dropdownOpened: false
        };
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
    handleDropdownOpened(opened) {
        this.setState({
            dropdownOpened: opened
        });
    }
    forceUpdateInfo() {
        this.refs.info.forceUpdate();
        this.refs.header.forceUpdate();
    }
    handlePostClick() {
        /* Disabled do to a bug: https://mattermost.atlassian.net/browse/PLT-3785
        if (e.altKey) {
            e.preventDefault();
            PostActions.setUnreadPost(this.props.post.channel_id, this.props.post.id);
        }
        */
    }
    shouldComponentUpdate(nextProps, nextState) {
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

        if (nextProps.isCommentMention !== this.props.isCommentMention) {
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

        if (nextProps.previewCollapsed !== this.props.previewCollapsed) {
            return true;
        }

        if (nextProps.useMilitaryTime !== this.props.useMilitaryTime) {
            return true;
        }

        if (nextProps.isFlagged !== this.props.isFlagged) {
            return true;
        }

        if (nextProps.status !== this.props.status) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.user, this.props.user)) {
            return true;
        }

        if (nextState.dropdownOpened !== this.state.dropdownOpened) {
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

        let hideControls = '';
        if (post.state === Constants.POST_DELETED || post.state === Constants.POST_FAILED) {
            hideControls = 'post--hide-controls';
        }

        const commentCount = this.props.commentCount;

        let rootUser;
        if (this.props.sameRoot) {
            rootUser = 'same--root';
        } else {
            rootUser = 'other--root';
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

        let postType = '';
        if (type !== 'Post') {
            postType = 'post--comment';
        } else if (commentCount > 0) {
            postType = 'post--root';
            sameUserClass = '';
            rootUser = '';
        }

        let systemMessageClass = '';
        if (PostUtils.isSystemMessage(post)) {
            systemMessageClass = 'post--system';
            sameUserClass = '';
            currentUserCss = '';
            postType = '';
            rootUser = '';
        }

        let profilePic = (
            <ProfilePicture
                src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                status={this.props.status}
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

        let centerClass = '';
        if (this.props.center) {
            centerClass = 'center';
        }

        let compactClass = '';
        let profilePicContainer = (<div className='post__img'>{profilePic}</div>);
        if (this.props.compactDisplay) {
            compactClass = 'post--compact';
            profilePicContainer = '';
        }

        let dropdownOpenedClass = '';
        if (this.state.dropdownOpened) {
            dropdownOpenedClass = 'post--hovered';
        }

        return (
            <div>
                <div
                    id={'post_' + post.id}
                    className={'post ' + sameUserClass + ' ' + compactClass + ' ' + rootUser + ' ' + postType + ' ' + currentUserCss + ' ' + shouldHighlightClass + ' ' + systemMessageClass + ' ' + hideControls + ' ' + dropdownOpenedClass}
                    onClick={this.handlePostClick}
                >
                    <div className={'post__content ' + centerClass}>
                        {profilePicContainer}
                        <div>
                            <PostHeader
                                ref='header'
                                post={post}
                                sameRoot={this.props.sameRoot}
                                commentCount={commentCount}
                                handleCommentClick={this.handleCommentClick}
                                handleDropdownOpened={this.handleDropdownOpened}
                                isLastComment={this.props.isLastComment}
                                sameUser={this.props.sameUser}
                                user={this.props.user}
                                currentUser={this.props.currentUser}
                                compactDisplay={this.props.compactDisplay}
                                displayNameType={this.props.displayNameType}
                                useMilitaryTime={this.props.useMilitaryTime}
                                isFlagged={this.props.isFlagged}
                            />
                            <PostBody
                                post={post}
                                sameRoot={this.props.sameRoot}
                                parentPost={parentPost}
                                handleCommentClick={this.handleCommentClick}
                                compactDisplay={this.props.compactDisplay}
                                previewCollapsed={this.props.previewCollapsed}
                                isCommentMention={this.props.isCommentMention}
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
    currentUser: React.PropTypes.object.isRequired,
    center: React.PropTypes.bool,
    compactDisplay: React.PropTypes.bool,
    previewCollapsed: React.PropTypes.string,
    commentCount: React.PropTypes.number,
    isCommentMention: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    isFlagged: React.PropTypes.bool,
    status: React.PropTypes.string
};
