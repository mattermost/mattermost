// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {AnyAction, bindActionCreators, Dispatch} from 'redux';

import {getThreadsForChannel} from 'mattermost-redux/actions/threads';

import {closeRightHandSide, goBack, selectPostFromRightHandSideSearchByPostId} from 'actions/views/rhs';
import {getPreviousRhsState} from 'selectors/rhs';

import type {Channel} from '@mattermost/types/channels';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import type {GlobalState} from 'types/store';

import ChannelThreads, {Props} from './channel_threads_rhs';
import {makeGetThreadsInChannelView} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

function makeMapStateToProps() {
    const getThreadsInChannelView = makeGetThreadsInChannelView();

    return (state: GlobalState) => {
        const channel = getCurrentChannel(state);
        const team = getCurrentTeam(state);
        const prevRhsState = getPreviousRhsState(state);

        if (!channel || !team) {
            return {
                channel: {} as Channel,
                canGoBack: false,
                threads: [],
                total: 0,
            } as unknown as Props;
        }

        const threads = getThreadsInChannelView(state, channel.id);

        return {
            canGoBack: Boolean(prevRhsState),
            channel,
            currentTeamId: team.id,
            currentTeamName: team.name,
            threads,
            total: threads.length,
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
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ChannelThreads);
