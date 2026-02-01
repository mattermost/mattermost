// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {AnyAction, Dispatch} from 'redux';

import {fetchRemoteClusterInfo} from 'mattermost-redux/actions/shared_channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getThreadFollowersThreadId, getPreviousRhsState} from 'selectors/rhs';
import {cleanMessageForDisplay} from 'components/threading/utils';

import type {GlobalState} from 'types/store';

import ThreadFollowersRHS from './thread_followers_rhs';

function mapStateToProps(state: GlobalState) {
    const threadId = getThreadFollowersThreadId(state);
    const rootPost = threadId ? getPost(state, threadId) : null;
    const thread = getThread(state, threadId);
    const threadName = thread?.props?.custom_name || (rootPost ? cleanMessageForDisplay(rootPost.message, 30) : '');
    const channelId = rootPost?.channel_id || '';
    const team = getCurrentTeam(state);
    const teamUrl = team ? `/${team.name}` : '';
    const previousRhsState = getPreviousRhsState(state);

    return {
        threadId,
        channelId,
        threadName,
        canGoBack: Boolean(previousRhsState),
        teamUrl,
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            openModal,
            openDirectChannelToUserId,
            closeRightHandSide,
            goBack,
            fetchRemoteClusterInfo,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ThreadFollowersRHS);
