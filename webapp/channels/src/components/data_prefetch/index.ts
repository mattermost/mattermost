// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getCurrentChannelId, getUnreadChannels} from 'mattermost-redux/selectors/entities/channels';
import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/common';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {prefetchChannelPosts} from 'actions/views/channel';
import {getCategoriesForCurrentTeam} from 'selectors/views/channel_sidebar';

import type {GlobalState} from 'types/store';

import {prefetchQueue} from './actions';
import DataPrefetch from './data_prefetch';

// This gates loadProfilesForSidebar, so it has to cover everything that action reads: its GM half
// reads getDisplayedChannels, which is driven by the categories, and its DM half reads
// getMyChannels, which needs both the channels and the memberships. It reads the store once when
// called and never retries, so opening this gate before all three have arrived silently loads no
// profiles at all for the rest of the session.
//
// The completion flags are important: the current channel can populate one channel or membership
// before the corresponding bulk request completes, which is not enough for loadProfilesForSidebar.
function isSidebarLoaded(state: GlobalState) {
    return getCategoriesForCurrentTeam(state).length > 0 &&
        state.views.channelSidebar.initChannelsLoaded &&
        state.views.channelSidebar.initChannelMembershipsLoaded;
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
        actions: bindActionCreators({
            prefetchChannelPosts,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DataPrefetch);
