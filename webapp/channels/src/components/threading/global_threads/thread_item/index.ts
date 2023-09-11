// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {memo} from 'react';
import {connect} from 'react-redux';
import {compose} from 'redux';

import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
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

        const post = getPost(state, threadId);

        if (!post) {
            return {};
        }

        return {
            post,
            channel: getChannel(state, {id: post.channel_id}),
            currentRelativeTeamUrl: getCurrentRelativeTeamUrl(state),
            displayName: getDisplayName(state, post.user_id, true),
            postsInThread: getPostsForThread(state, post.id),
            thread: getThread(state, threadId),
            isPostPriorityEnabled: isPostPriorityEnabled(state),
        };
    };
}

export default compose(
    connect(makeMapStateToProps),
    memo,
)(ThreadItem) as React.FunctionComponent<OwnProps>;
