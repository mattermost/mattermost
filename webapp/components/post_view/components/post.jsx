// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {Component, PropTypes} from 'react';

import ProfilePicture from 'components/profile_picture.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import Constants, {ActionTypes} from 'utils/constants.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import * as Utils from 'utils/utils.jsx';

import PostBody from './post_body.jsx';
import PostHeader from './post_header.jsx';

export default class Post extends Component {
    static propTypes = {
        post: PropTypes.object.isRequired,
        parentPost: PropTypes.object,
        user: PropTypes.object,
        sameUser: PropTypes.bool,
        sameRoot: PropTypes.bool,
        hideProfilePic: PropTypes.bool,
        isLastPost: PropTypes.bool,
        isLastComment: PropTypes.bool,
        shouldHighlight: PropTypes.bool,
        displayNameType: PropTypes.string,
        currentUser: PropTypes.object.isRequired,
        center: PropTypes.bool,
        compactDisplay: PropTypes.bool,
        previewCollapsed: PropTypes.string,
        commentCount: PropTypes.number,
        isCommentMention: PropTypes.bool,
        useMilitaryTime: PropTypes.bool.isRequired,
        isFlagged: PropTypes.bool,
        status: PropTypes.string,
        isBusy: PropTypes.bool,
        childComponentDidUpdateFunction: PropTypes.func
    };

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

        if (nextProps.isBusy !== this.props.isBusy) {
            return true;
        }

        return false;
    }

    getClassName = (post, isSystemMessage, fromWebhook) => {
        let className = 'post';

        if (post.state === Constants.POST_DELETED || post.state === Constants.POST_FAILED) {
            className += ' post--hide-controls';
        }

        if (this.props.shouldHighlight) {
            className += ' post--highlight';
        }

        let rootUser;
        if (this.props.sameRoot) {
            rootUser = 'same--root';
        } else {
            rootUser = 'other--root';
        }

        let currentUserCss = '';
        if (this.props.currentUser.id === post.user_id && !fromWebhook && !isSystemMessage) {
            currentUserCss = 'current--user';
        }

        let sameUserClass = '';
        if (this.props.sameUser) {
            sameUserClass = 'same--user';
        }

        let postType = '';
        if (post.root_id && post.root_id.length > 0) {
            postType = 'post--comment';
        } else if (this.props.commentCount > 0) {
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
        const parentPost = this.props.parentPost;
        const mattermostLogo = Constants.MATTERMOST_ICON_SVG;

        const isSystemMessage = PostUtils.isSystemMessage(post);
        const fromWebhook = post.props && post.props.from_webhook === 'true';

        let timestamp = 0;
        if (!this.props.user || this.props.user.last_picture_update == null) {
            timestamp = this.props.currentUser.last_picture_update;
        } else {
            timestamp = this.props.user.last_picture_update;
        }

        let status = this.props.status;
        if (fromWebhook) {
            status = null;
        }

        let profilePic = (
            <ProfilePicture
                src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                status={status}
                user={this.props.user}
                isBusy={this.props.isBusy}
            />
        );

        if (fromWebhook) {
            profilePic = (
                <ProfilePicture
                    src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                />
            );
        } else if (isSystemMessage) {
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
            if (post.props && post.props.from_webhook) {
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
                                sameRoot={this.props.sameRoot}
                                commentCount={this.props.commentCount}
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
                                status={this.props.status}
                                isBusy={this.props.isBusy}
                            />
                            <PostBody
                                post={post}
                                currentUser={this.props.currentUser}
                                sameRoot={this.props.sameRoot}
                                isLastPost={this.props.isLastPost}
                                parentPost={parentPost}
                                handleCommentClick={this.handleCommentClick}
                                compactDisplay={this.props.compactDisplay}
                                previewCollapsed={this.props.previewCollapsed}
                                isCommentMention={this.props.isCommentMention}
                                childComponentDidUpdateFunction={this.props.childComponentDidUpdateFunction}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
