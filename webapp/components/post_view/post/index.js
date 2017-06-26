// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';

import {getCurrentUser, getUser, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {Preferences} from 'utils/constants.jsx';

import Post from './post.jsx';

function mapStateToProps(state, ownProps) {
    const detailedPost = ownProps.post || {};

    return {
        post: getPost(state, detailedPost.id),
        lastPostCount: ownProps.lastPostCount,
        user: getUser(state, detailedPost.user_id),
        status: getStatusForUserId(state, detailedPost.user_id),
        currentUser: getCurrentUser(state),
        isFirstReply: Boolean(detailedPost.isFirstReply && detailedPost.commentedOnPost),
        highlight: detailedPost.highlight,
        consecutivePostByUser: detailedPost.consecutivePostByUser,
        previousPostIsComment: detailedPost.previousPostIsComment,
        replyCount: detailedPost.replyCount,
        isCommentMention: detailedPost.isCommentMention,
        center: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
        compactDisplay: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT
    };
}

export default connect(mapStateToProps)(Post);
