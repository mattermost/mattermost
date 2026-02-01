// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {AnyAction, Dispatch} from 'redux';

import {fetchRemoteClusterInfo} from 'mattermost-redux/actions/shared_channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide, goBack} from 'actions/views/rhs';
import {getThreadFollowersThreadId, getPreviousRhsState} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import ThreadFollowersRHS from './thread_followers_rhs';

// Clean up message text for display in header
function cleanMessageForDisplay(message: string): string {
    if (!message) {
        return '';
    }

    let cleaned = message.
        // Remove code blocks
        replace(/```[\s\S]*?```/g, '[code]').
        replace(/`[^`]+`/g, '[code]').

        // Remove links but keep text
        replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').

        // Remove images
        replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]').

        // Remove bold/italic
        replace(/\*\*([^*]+)\*\*/g, '$1').
        replace(/\*([^*]+)\*/g, '$1').
        replace(/__([^_]+)__/g, '$1').
        replace(/_([^_]+)_/g, '$1').

        // Remove headers
        replace(/^#+\s+/gm, '').

        // Remove blockquotes
        replace(/^>\s+/gm, '').

        // Remove horizontal rules
        replace(/^---+$/gm, '').

        // Collapse whitespace
        replace(/\s+/g, ' ').
        trim();

    // Truncate if too long
    if (cleaned.length > 30) {
        cleaned = cleaned.substring(0, 30) + '...';
    }

    return cleaned;
}

function mapStateToProps(state: GlobalState) {
    const threadId = getThreadFollowersThreadId(state);
    const rootPost = threadId ? getPost(state, threadId) : null;
    const threadName = rootPost ? cleanMessageForDisplay(rootPost.message) : '';
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
