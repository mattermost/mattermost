// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {markChannelAsRead} from 'mattermost-redux/actions/channels';
import {getTotalUsersStats} from 'mattermost-redux/actions/users';
import {RequestStatus} from 'mattermost-redux/constants';
import {getChannel, isMyChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';
import {getRecentPostsChunkInChannel, makeGetPostsChunkAroundPost, getUnreadPostsChunk, getPost, isPostsChunkIncludingUnreadsPosts, getLimitedViews} from 'mattermost-redux/selectors/entities/posts';
import {getTotalUsersStats as getTotalUsersStatsSelector} from 'mattermost-redux/selectors/entities/users';
import {memoizeResult} from 'mattermost-redux/utils/helpers';
import {makePreparePostIdsForPostList} from 'mattermost-redux/utils/post_list';

import {updateNewMessagesAtInChannel} from 'actions/global_actions';
import {
    loadPosts,
    loadUnreads,
    loadPostsAround,
    syncPostsInChannel,
    loadLatestPosts,
} from 'actions/views/channel';
import {getIsMobileView} from 'selectors/views/browser';

import {Constants} from 'utils/constants';
import {getLatestPostId} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

import PostList from './post_list';

const isFirstLoad = (state: GlobalState, channelId: string) => !state.entities.posts.postsInChannel[channelId];

// The intro for these channels picks its action buttons based on the total user count
const isChannelIntroUsingTotalUsers = (state: GlobalState, channelId: string) => {
    const channelType = getChannel(state, channelId)?.type;
    return channelType !== Constants.DM_CHANNEL && channelType !== Constants.GM_CHANNEL;
};
const memoizedGetLatestPostId = memoizeResult((postIds: string[]) => getLatestPostId(postIds));

// This function is added as a fail safe for the channel sync issue we have.
// When the user switches to a team for the first time we show the channel of previous team and then settle for the right channel after that
// This causes the scroll correction etc an issue because post_list is not mounted for new channel instead it is updated

interface Props {
    focusedPostId?: string;
    unreadChunkTimeStamp?: number;
    changeUnreadChunkTimeStamp: (lastViewedAt: number) => void;
    channelId: string;
}

function makeMapStateToProps() {
    const getPostsChunkAroundPost = makeGetPostsChunkAroundPost();
    const preparePostIdsForPostList = makePreparePostIdsForPostList();

    return function mapStateToProps(state: GlobalState, ownProps: Pick<Props, 'focusedPostId' | 'unreadChunkTimeStamp' | 'channelId'> & {shouldStartFromBottomWhenUnread: boolean}) {
        let latestPostTimeStamp = 0;
        let postIds: string[] | undefined;
        let chunk;
        let atLatestPost = false;
        let atOldestPost = false;
        let formattedPostIds: string[] | undefined;
        const {focusedPostId, unreadChunkTimeStamp, channelId, shouldStartFromBottomWhenUnread} = ownProps;
        const channelViewState = state.views.channel;
        const lastViewedAt = channelViewState.lastChannelViewTime[channelId];
        const isPrefetchingInProcess = channelViewState.channelPrefetchStatus[channelId] === RequestStatus.STARTED;
        const limitedViews = getLimitedViews(state);
        const hasInaccessiblePosts = Boolean(limitedViews.channels[channelId]) || limitedViews.channels[channelId] === 0;

        const focusedPost = getPost(state, focusedPostId || '');

        if (focusedPostId && focusedPost !== undefined) {
            chunk = getPostsChunkAroundPost(state, focusedPostId, channelId);
        } else if (unreadChunkTimeStamp && !shouldStartFromBottomWhenUnread) {
            chunk = getUnreadPostsChunk(state, channelId, unreadChunkTimeStamp);
        } else {
            chunk = getRecentPostsChunkInChannel(state, channelId);
        }

        if (chunk) {
            postIds = chunk.order;
            atLatestPost = Boolean(chunk.recent);
            atOldestPost = Boolean(chunk.oldest);
        }

        let shouldHideNewMessageIndicator = false;
        if (unreadChunkTimeStamp != null) {
            shouldHideNewMessageIndicator = shouldStartFromBottomWhenUnread && !isPostsChunkIncludingUnreadsPosts(state, chunk!, unreadChunkTimeStamp);
        }

        if (postIds) {
            formattedPostIds = preparePostIdsForPostList(state, {postIds, lastViewedAt, indicateNewMessages: !shouldHideNewMessageIndicator});
            if (postIds.length) {
                const latestPostId = memoizedGetLatestPostId(postIds);
                const latestPost = getPost(state, latestPostId);
                latestPostTimeStamp = latestPost.create_at;
            }
        }

        return {
            lastViewedAt,
            isFirstLoad: isFirstLoad(state, channelId),
            formattedPostIds,
            atLatestPost,
            atOldestPost,
            latestPostTimeStamp,
            postListIds: postIds,
            isPrefetchingInProcess,
            shouldStartFromBottomWhenUnread,
            isMobileView: getIsMobileView(state),
            hasInaccessiblePosts,
            isChannelAutotranslated: isMyChannelAutotranslated(state, channelId),
            needsTotalUsersStats: atOldestPost && getTotalUsersStatsSelector(state).total_users_count === undefined && isChannelIntroUsingTotalUsers(state, channelId),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            loadUnreads,
            loadPosts,
            loadLatestPosts,
            loadPostsAround,
            syncPostsInChannel,
            markChannelAsRead,
            updateNewMessagesAtInChannel,
            getTotalUsersStats,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PostList);
