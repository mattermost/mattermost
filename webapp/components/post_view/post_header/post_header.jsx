// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserProfile from 'components/user_profile.jsx';
import PostInfo from 'components/post_view/post_info';
import {FormattedMessage} from 'react-intl';

import * as PostUtils from 'utils/post_utils.jsx';

import Constants from 'utils/constants.jsx';

import React from 'react';
import PropTypes from 'prop-types';

export default class PostHeader extends React.PureComponent {
    static propTypes = {

        /*
         * The post to render the header for
         */
        post: PropTypes.object.isRequired,

        /*
         * The user who created the post
         */
        user: PropTypes.object,

        /*
         * Function called when the comment icon is clicked
         */
        handleCommentClick: PropTypes.func.isRequired,

        /*
         * Function called when the post options dropdown is opened
         */
        handleDropdownOpened: PropTypes.func.isRequired,

        /*
         * Set to render compactly
         */
        compactDisplay: PropTypes.bool,

        /*
         * Set to render the post as if it was part of the previous post
         */
        consecutivePostByUser: PropTypes.bool,

        /*
         * The method for displaying the post creator's name
         */
        displayNameType: PropTypes.string,

        /*
         * The status of the user who created the post
         */
        status: PropTypes.string,

        /*
         * Set if the post creator is currenlty in a WebRTC call
         */
        isBusy: PropTypes.bool,

        /*
         * The number of replies in the same thread as this post
         */
        replyCount: PropTypes.number,

        /*
         * Post identifiers for selenium tests
         */
        lastPostCount: PropTypes.number,

        /**
         * Function to get the post list HTML element
         */
        getPostList: PropTypes.func.isRequired
    }

    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        const post = this.props.post;
        const isSystemMessage = PostUtils.isSystemMessage(post);

        let userProfile = (
            <UserProfile
                user={this.props.user}
                displayNameType={this.props.displayNameType}
                status={this.props.status}
                isBusy={this.props.isBusy}
                hasMention={true}
            />
        );
        let botIndicator;
        let colon;

        if (post.props && post.props.from_webhook) {
            if (post.props.override_username && global.window.mm_config.EnablePostUsernameOverride === 'true') {
                userProfile = (
                    <UserProfile
                        user={this.props.user}
                        overwriteName={post.props.override_username}
                        disablePopover={true}
                    />
                );
            } else {
                userProfile = (
                    <UserProfile
                        user={this.props.user}
                        displayNameType={this.props.displayNameType}
                        disablePopover={true}
                    />
                );
            }

            botIndicator = <div className='bot-indicator'>{Constants.BOT_NAME}</div>;
        } else if (isSystemMessage) {
            userProfile = (
                <UserProfile
                    user={{}}
                    overwriteName={
                        <FormattedMessage
                            id='post_info.system'
                            defaultMessage='System'
                        />
                    }
                    overwriteImage={Constants.SYSTEM_MESSAGE_PROFILE_IMAGE}
                    disablePopover={true}
                />
            );
        }

        if (this.props.compactDisplay) {
            colon = (<strong className='colon'>{':'}</strong>);
        }

        return (
            <div className='post__header'>
                <div className='col col__name'>{userProfile}{colon}</div>
                {botIndicator}
                <div className='col'>
                    <PostInfo
                        post={post}
                        handleCommentClick={this.props.handleCommentClick}
                        handleDropdownOpened={this.props.handleDropdownOpened}
                        compactDisplay={this.props.compactDisplay}
                        lastPostCount={this.props.lastPostCount}
                        replyCount={this.props.replyCount}
                        consecutivePostByUser={this.props.consecutivePostByUser}
                        getPostList={this.props.getPostList}
                    />
                </div>
            </div>
        );
    }
}
