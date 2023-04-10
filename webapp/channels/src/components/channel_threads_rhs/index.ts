// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {AnyAction, bindActionCreators, Dispatch} from 'redux';

import {getThreadsCountsForChannel, getThreadsForChannel} from 'mattermost-redux/actions/threads';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadCountsInChannelView, makeGetThreadsInChannelView} from 'mattermost-redux/selectors/entities/threads';

import {closeRightHandSide, goBack, selectPostFromRightHandSideSearchByPostId, toggleRhsExpanded} from 'actions/views/rhs';
import {getIsRhsExpanded, getPreviousRhsState} from 'selectors/rhs';

import {FetchChannelThreadOptions, FetchChannelThreadFilters} from '@mattermost/types/client4';
import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from 'types/store';

import ChannelThreads, {Props, Tabs} from './channel_threads_rhs';

function getThreadsForChannelWithFilter(channelId: Channel['id'], tab: Tabs, options?: FetchChannelThreadOptions) {
    let filter;
    if (tab === Tabs.FOLLOWING) {
        filter = FetchChannelThreadFilters.FOLLOWING;
    }
    if (tab === Tabs.CREATED) {
        filter = FetchChannelThreadFilters.CREATED;
    }

    return getThreadsForChannel(channelId, {...options, filter});
}

function makeMapStateToProps() {
    const getThreadsInChannelView = makeGetThreadsInChannelView();
    const getFollowingThreadsInChannelView = makeGetThreadsInChannelView('following');
    const getCreatedThreadsInChannelView = makeGetThreadsInChannelView('created');
    const getThreadCountInChannelView = makeGetThreadCountsInChannelView();

    return (state: GlobalState) => {
        const channel = getCurrentChannel(state);
        const team = getCurrentTeam(state);
        const currentUserId = getCurrentUserId(state);
        const prevRhsState = getPreviousRhsState(state);

        if (!channel || !team) {
            return {
                channel: {} as Channel,
                canGoBack: false,
                threads: [],
                total: 0,
            } as unknown as Props;
        }

        const counts = getThreadCountInChannelView(state, channel.id);

        const all = getThreadsInChannelView(state, channel.id);
        const following = getFollowingThreadsInChannelView(state, channel.id);
        const created = getCreatedThreadsInChannelView(state, channel.id);

        return {
            all,
            canGoBack: Boolean(prevRhsState),
            channel,
            created,
            currentTeamId: team.id,
            currentTeamName: team.name,
            currentUserId,
            following,
            isSideBarExpanded: getIsRhsExpanded(state),
            total: counts.total || 0,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            closeRightHandSide,
            getThreadsCountsForChannel,
            getThreadsForChannel: getThreadsForChannelWithFilter,
            goBack,
            selectPostFromRightHandSideSearchByPostId,
            toggleRhsExpanded,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ChannelThreads);
