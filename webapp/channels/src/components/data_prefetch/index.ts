// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannelSetInCurrentTeam, getCurrentChannelId, getUnreadChannels} from 'mattermost-redux/selectors/entities/channels';
import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/common';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {prefetchChannelPosts} from 'actions/views/channel';
import {getCategoriesForCurrentTeam} from 'selectors/views/channel_sidebar';

import type {GlobalState} from 'types/store';

import {prefetchQueue} from './actions';
import DataPrefetch from './data_prefetch';

const hasChannelMemberships = createSelector(
    'hasChannelMemberships',
    getMyChannelMemberships,
    (memberships) => Object.keys(memberships).length > 0,
);

// This gates loadProfilesForSidebar, so it has to cover everything that action reads: its GM half
// reads getDisplayedChannels, which is driven by the categories, and its DM half reads
// getMyChannels, which needs both the channels and the memberships. It reads the store once when
// called and never retries, so opening this gate before all three have arrived silently loads no
// profiles at all for the rest of the session.
//
// Each check stands in for "that request landed", which holds because nothing populates categories,
// channels or memberships ahead of the initial fetches. dm_gm_profiles_on_load.spec.ts covers the
// orderings, so a future early write breaks a test rather than a sidebar row.
function isSidebarLoaded(state: GlobalState) {
    return getCategoriesForCurrentTeam(state).length > 0 &&
        getChannelSetInCurrentTeam(state).size > 0 &&
        hasChannelMemberships(state);
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
