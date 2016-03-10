// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserProfile from './user_profile.jsx';
import PostInfo from './post_info.jsx';
import * as Utils from '../utils/utils.jsx';

import Constants from '../utils/constants.jsx';

export default class PostHeader extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        const post = this.props.post;
        const user = this.props.user;

        let userProfile = <UserProfile user={user}/>;
        let botIndicator;

        if (post.props && post.props.from_webhook) {
            if (post.props.override_username && global.window.mm_config.EnablePostUsernameOverride === 'true') {
                userProfile = (
                    <UserProfile
                        user={user}
                        overwriteName={post.props.override_username}
                        disablePopover={true}
                    />
                );
            }

            botIndicator = <li className='col col__name bot-indicator'>{'BOT'}</li>;
        } else if (Utils.isSystemMessage(post)) {
            userProfile = (
                <UserProfile
                    user={{}}
                    overwriteName={Constants.SYSTEM_MESSAGE_PROFILE_NAME}
                    overwriteImage={Constants.SYSTEM_MESSAGE_PROFILE_IMAGE}
                    disablePopover={true}
                />
            );
        }

        return (
            <ul className='post__header'>
                <li className='col col__name'>{userProfile}</li>
                {botIndicator}
                <li className='col'>
                    <PostInfo
                        post={post}
                        commentCount={this.props.commentCount}
                        handleCommentClick={this.props.handleCommentClick}
                        allowReply='true'
                        isLastComment={this.props.isLastComment}
                        sameUser={this.props.sameUser}
                    />
                </li>
            </ul>
        );
    }
}

PostHeader.defaultProps = {
    post: null,
    commentCount: 0,
    isLastComment: false,
    sameUser: false
};
PostHeader.propTypes = {
    post: React.PropTypes.object,
    user: React.PropTypes.object,
    commentCount: React.PropTypes.number,
    isLastComment: React.PropTypes.bool,
    handleCommentClick: React.PropTypes.func,
    sameUser: React.PropTypes.bool
};
