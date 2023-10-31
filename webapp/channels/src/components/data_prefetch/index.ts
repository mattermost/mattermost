// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {PostList} from '@mattermost/types/posts';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {getCurrentChannelId, getUnreadChannels} from 'mattermost-redux/selectors/entities/channels';
import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/common';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import {memoizeResult} from 'mattermost-redux/utils/helpers';

import {prefetchChannelPosts} from 'actions/views/channel';
import {getCategoriesForCurrentTeam} from 'selectors/views/channel_sidebar';

import type {GlobalState} from 'types/store';

import {trackPreloadedChannels} from './actions';
import DataPrefetch from './data_prefetch';

type Actions = {
    prefetchChannelPosts: (channelId: string, delay?: number) => Promise<{data: PostList}>;
    trackPreloadedChannels: (prefetchQueueObj: Record<string, string[]>) => void;
};

enum Priority {
    high = 1,
    medium,
    low
}

// function to return a queue obj with priotiy as key and array of channelIds as values.
// high priority has channels with mentions
// medium priority has channels with unreads
// <10 unread channels. Prefetch everything.
// 10-20 unread. Prefetch only mentions, capped to 10.
// >20 unread. Don't prefetch anything.
const prefetchQueue = memoizeResult((
    unreadChannels: Channel[],
    memberships: RelationOneToOne<Channel, ChannelMembership>,
    collapsedThreads: boolean,
) => {
    const unreadChannelsCount = unreadChannels.length;
    let defaultResult: {
        1: string[];
        2: string[];
        3: string[];
    } = {
        [Priority.high]: [], // 1 being high priority requests
        [Priority.medium]: [],
        [Priority.low]: [], //TODO: add chanenls such as fav.
    };
    if (!unreadChannelsCount || unreadChannelsCount > 20) {
        return defaultResult;
    }
    for (const channel of unreadChannels) {
        const channelId = channel.id;
        const membership = memberships[channelId];

        if (unreadChannelsCount >= 10 && defaultResult[Priority.high].length >= 10) {
            break;
        }

        // TODO We check for muted channels 3 times here: getUnreadChannels checks it, this checks it, and the mark_unread
        // check below is equivalent to checking if its muted.
        if (membership && !isChannelMuted(membership)) {
            if (collapsedThreads ? membership.mention_count_root : membership.mention_count) {
                defaultResult = {
                    ...defaultResult,
                    [Priority.high]: [...defaultResult[Priority.high], channelId],
                };
            } else if (
                membership.notify_props &&
                membership.notify_props.mark_unread !== 'mention' &&
                unreadChannelsCount < 10
            ) {
                defaultResult = {
                    ...defaultResult,
                    [Priority.medium]: [...defaultResult[Priority.medium], channelId],
                };
            }
        }
    }
    return defaultResult;
});

function isSidebarLoaded(state: GlobalState) {
    return getCategoriesForCurrentTeam(state).length > 0;
}

function mapStateToProps(state: GlobalState) {
    const lastUnreadChannel = state.views.channel.lastUnreadChannel;
    const memberships = getMyChannelMemberships(state);
    const unreadChannels = getUnreadChannels(state, lastUnreadChannel);
    const prefetchQueueObj = prefetchQueue(unreadChannels, memberships, isCollapsedThreadsEnabled(state));
    const prefetchRequestStatus = state.views.channel.channelPrefetchStatus;

    return {
        currentChannelId: getCurrentChannelId(state),
        prefetchQueueObj,
        prefetchRequestStatus,
        sidebarLoaded: isSidebarLoaded(state),
        unreadChannels,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            prefetchChannelPosts,
            trackPreloadedChannels,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DataPrefetch);
