// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {withRouter} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {Posts} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentChannel, countCurrentChannelUnreadMessages, isManuallyUnread} from 'mattermost-redux/selectors/entities/channels';
import {getAllPosts, getPostIdsInChannel} from 'mattermost-redux/selectors/entities/posts';
import {getUnreadScrollPositionPreference, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {makePreparePostIdsForPostList} from 'mattermost-redux/utils/post_list';

import {updateToastStatus} from 'actions/views/channel';

import type {GlobalState} from 'types/store/index';

import ToastWrapper from './toast_wrapper';

interface OwnProps {
    atLatestPost?: boolean;
    channelId: string;
}

export function makeGetRootPosts() {
    return createSelector(
        'makeGetRootPosts',
        getAllPosts,
        getCurrentUserId,
        getCurrentChannel,
        (allPosts, currentUserId, channel) => {
            // Count the number of new posts that haven't been deleted and are root posts
            return Object.values(allPosts).filter((post) => {
                return (
                    post.root_id === '' &&
                    post.channel_id === channel?.id &&
                    post.state !== Posts.POST_DELETED
                );
            }).reduce((map: Record<string, boolean>, obj) => {
                map[obj.id] = true;
                return map;
            }, {});
        },
    );
}

export function makeCountUnreadsBelow() {
    return createSelector(
        'makeCountUnreadsBelow',
        getAllPosts,
        getCurrentUserId,
        (state: GlobalState, postIds: string[]) => postIds,
        (state: GlobalState, postIds, lastViewedBottom: number) => lastViewedBottom,
        isCollapsedThreadsEnabled,
        (allPosts, currentUserId, postIds, lastViewedBottom, isCollapsed) => {
            if (!postIds) {
                return 0;
            }

            // Count the number of new posts made by other users that haven't been deleted
            return postIds.map((id) => allPosts[id]).filter((post) => {
                return post &&
                    post.user_id !== currentUserId &&
                    post.state !== Posts.POST_DELETED &&
                    post.create_at > lastViewedBottom &&
                    (isCollapsed ? post.root_id === '' : true); // in collapsed threads mode, only count root posts
            }).length;
        },
    );
}

/* This connected component is written mainly for maintaining the unread count to be passed to the toast
   Unread count logic:
   * If channel is at the latest set of posts:
      Unread count is the Number of posts below new message line
   * if channel is not at the latest set of posts:
      1. UnreadCount + any recent messages in the latest chunk.
      2. If channel was marked as unread.
        * Unread count of channel alone.
*/

function makeMapStateToProps() {
    const countUnreadsBelow = makeCountUnreadsBelow();
    const getRootPosts = makeGetRootPosts();
    const preparePostIdsForPostList = makePreparePostIdsForPostList();
    return function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
        let newRecentMessagesCount = 0;
        const channelMarkedAsUnread = isManuallyUnread(state, ownProps.channelId);
        const lastViewedAt = state.views.channel.lastChannelViewTime[ownProps.channelId];
        const unreadScrollPosition = getUnreadScrollPositionPreference(state);
        if (!ownProps.atLatestPost) {
            let postIds = getPostIdsInChannel(state, ownProps.channelId) || [];
            if (postIds) {
                postIds = preparePostIdsForPostList(state, {postIds, lastViewedAt});
            }
            newRecentMessagesCount = countUnreadsBelow(state, postIds, lastViewedAt);
        }
        return {
            rootPosts: getRootPosts(state),
            lastViewedAt,
            newRecentMessagesCount,
            unreadScrollPosition,
            isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
            unreadCountInChannel: countCurrentChannelUnreadMessages(state),
            channelMarkedAsUnread,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateToastStatus,
        }, dispatch),
    };
}

export default withRouter(connect(makeMapStateToProps, mapDispatchToProps)(ToastWrapper));
