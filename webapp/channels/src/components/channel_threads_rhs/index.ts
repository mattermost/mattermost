// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {AnyAction, bindActionCreators, Dispatch} from 'redux';

import {getThreadsForChannel} from 'mattermost-redux/actions/threads';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadCountsInChannelView, makeGetThreadsInChannelView} from 'mattermost-redux/selectors/entities/threads';

import {setGlobalItem} from 'actions/storage';
import {closeRightHandSide, goBack, selectPostFromRightHandSideSearchByPostId, toggleRhsExpanded} from 'actions/views/rhs';
import {getIsRhsExpanded, getPreviousRhsState} from 'selectors/rhs';
import {makeGetGlobalItemWithDefault} from 'selectors/storage';
import {StoragePrefixes} from 'utils/constants';

import {FetchChannelThreadOptions, FetchChannelThreadFilters} from '@mattermost/types/client4';
import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from 'types/store';

import ChannelThreads, {Props, Tabs} from './channel_threads_rhs';

function setChannelThreadsTab(channelId: Channel['id'], tab: Tabs) {
    const key = StoragePrefixes.CHANNEL_THREADS_TAB + channelId;
    return setGlobalItem(key, tab);
}

function makeGetChannelThreadsTab() {
    const getGlobalItem = makeGetGlobalItemWithDefault(Tabs.ALL);

    return (state: GlobalState, channelId: Channel['id']) => {
        const isCRT = isCollapsedThreadsEnabled(state);
        const key = StoragePrefixes.CHANNEL_THREADS_TAB + channelId;
        const tab = getGlobalItem(state, key);

        if (!isCRT && tab === Tabs.FOLLOWING) {
            return Tabs.ALL;
        }

        return tab;
    };
}

function getThreadsForChannelWithFilter(channelId: Channel['id'], tab: Tabs, options?: FetchChannelThreadOptions) {
    let filter;
    if (tab === Tabs.FOLLOWING) {
        filter = FetchChannelThreadFilters.FOLLOWING;
    }
    if (tab === Tabs.USER) {
        filter = FetchChannelThreadFilters.USER;
    }

    return getThreadsForChannel(channelId, {...options, filter});
}

function makeMapStateToProps() {
    const getThreadsInChannelView = makeGetThreadsInChannelView();
    const getFollowingThreadsInChannelView = makeGetThreadsInChannelView('following');
    const getCreatedThreadsInChannelView = makeGetThreadsInChannelView('created');
    const getThreadCountInChannelView = makeGetThreadCountsInChannelView();
    const getChannelThreadsTab = makeGetChannelThreadsTab();

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
            isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
            isSideBarExpanded: getIsRhsExpanded(state),
            total: counts.total || 0,
            totalFollowing: counts.total_following || 0,
            totalUser: counts.total_user || 0,
            selected: getChannelThreadsTab(state, channel.id),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            closeRightHandSide,
            getThreadsForChannel: getThreadsForChannelWithFilter,
            goBack,
            selectPostFromRightHandSideSearchByPostId,
            toggleRhsExpanded,
            setSelected: setChannelThreadsTab,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ChannelThreads);
