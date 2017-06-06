// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {makeGetPostsInChannel, makeGetPostsAroundPost} from 'mattermost-redux/selectors/entities/posts';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getPosts, getPostsBefore, getPostsAfter, getPostThread} from 'mattermost-redux/actions/posts';
import {increasePostVisibility} from 'actions/post_actions.jsx';
import {Preferences} from 'utils/constants.jsx';

import PostList from './post_list.jsx';

function makeMapStateToProps() {
    const getPostsInChannel = makeGetPostsInChannel();
    const getPostsAroundPost = makeGetPostsAroundPost();

    return function mapStateToProps(state, ownProps) {
        let posts;
        if (ownProps.focusedPostId) {
            posts = getPostsAroundPost(state, ownProps.focusedPostId, ownProps.channelId);
        } else {
            posts = getPostsInChannel(state, ownProps.channelId);
        }

        return {
            channel: getChannel(state, ownProps.channelId),
            lastViewedAt: state.views.channel.lastChannelViewTime[ownProps.channelId],
            posts,
            postVisibility: state.views.channel.postVisibility[ownProps.channelId],
            loadingPosts: state.views.channel.loadingPosts[ownProps.channelId],
            focusedPostId: ownProps.focusedPostId,
            currentUserId: getCurrentUserId(state),
            fullWidth: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN
        };
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getPosts,
            getPostsBefore,
            getPostsAfter,
            getPostThread,
            increasePostVisibility
        }, dispatch)
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PostList);
