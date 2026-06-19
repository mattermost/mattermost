// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {isMyChannelAutotranslated, makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost, isPostPriorityEnabled, makeGetPostsForThread} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import ThreadItem from './thread_item';
import type {OwnProps} from './thread_item';

function makeMapStateToProps() {
    const getPostsForThread = makeGetPostsForThread();
    const getChannel = makeGetChannel();
    const getDisplayName = makeGetDisplayName();

    return (state: GlobalState, ownProps: OwnProps) => {
        const {threadId} = ownProps;

        // Thread roots are always posts (a wiki page-comment thread is rooted on the comment
        // post, never on the page — a page is not a post and cannot anchor a thread).
        const post = getPost(state, threadId);
        const thread = getThread(state, threadId);

        if (!post) {
            return {};
        }

        const channelId = post.channel_id;
        return {
            post,
            channel: getChannel(state, channelId),
            currentRelativeTeamUrl: getCurrentRelativeTeamUrl(state),
            displayName: getDisplayName(state, post.user_id, true),
            postsInThread: getPostsForThread(state, post.id),
            thread,
            isPostPriorityEnabled: isPostPriorityEnabled(state),
            isChannelAutotranslated: isMyChannelAutotranslated(state, channelId),
        };
    };
}

export default connect(makeMapStateToProps)(ThreadItem);
