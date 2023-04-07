// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {AnyAction, bindActionCreators, Dispatch} from 'redux';

import {getThreadsCountsForChannel, getThreadsForChannel} from 'mattermost-redux/actions/threads';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadCountsInChannelView, makeGetThreadsInChannelView} from 'mattermost-redux/selectors/entities/threads';

import {closeRightHandSide, goBack, selectPostFromRightHandSideSearchByPostId} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from 'types/store';

import ChannelThreads, {Props} from './channel_threads_rhs';

function makeMapStateToProps() {
    const getThreadsInChannelView = makeGetThreadsInChannelView();
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
        const following: string[] = [];
        const created: string[] = [];

        return {
            all,
            canGoBack: Boolean(prevRhsState),
            channel,
            created,
            currentTeamId: team.id,
            currentTeamName: team.name,
            currentUserId,
            following,
            total: counts.total || 0,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            closeRightHandSide,
            goBack,
            selectPostFromRightHandSideSearchByPostId,
            getThreadsForChannel,
            getThreadsCountsForChannel,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ChannelThreads);
