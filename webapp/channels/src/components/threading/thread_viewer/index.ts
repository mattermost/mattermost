// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';
import type {ClientConfig} from '@mattermost/types/config';
import type {UserThread} from '@mattermost/types/threads';

import {fetchRHSAppsBindings} from 'mattermost-redux/actions/apps';
import {getNewestPostThread, getPostThread} from 'mattermost-redux/actions/posts';
import {getThread as fetchThread, updateThreadRead} from 'mattermost-redux/actions/threads';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost, makeGetPostIdsForThread} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {selectPostCard} from 'actions/views/rhs';
import {updateThreadLastOpened} from 'actions/views/threads';
import {getHighlightedPostId, getSelectedPostFocussedAt} from 'selectors/rhs';
import {getSocketStatus} from 'selectors/views/websocket';

import type {GlobalState} from 'types/store';

import ThreadViewer from './thread_viewer';

type OwnProps = {
    rootPostId: string;
};

function makeMapStateToProps() {
    const getPostIdsForThread = makeGetPostIdsForThread();
    const getChannel = makeGetChannel();

    return function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
        const currentUserId = getCurrentUserId(state);
        const currentTeamId = getCurrentTeamId(state);
        const selected = getPost(state, ownProps.rootPostId);
        const socketStatus = getSocketStatus(state);
        const highlightedPostId = getHighlightedPostId(state);
        const selectedPostFocusedAt = getSelectedPostFocussedAt(state);
        const config: Partial<ClientConfig> = getConfig(state);
        const enableWebSocketEventScope = config.FeatureFlagWebSocketEventScope === 'true';

        let postIds: string[] = [];
        let userThread: UserThread | null = null;
        let channel: Channel | null = null;

        if (selected) {
            postIds = getPostIdsForThread(state, selected.id);
            userThread = getThread(state, selected.id);
            channel = getChannel(state, {id: selected.channel_id});
        }

        return {
            isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
            appsEnabled: appsEnabled(state),
            currentUserId,
            currentTeamId,
            userThread,
            selected,
            postIds,
            socketConnectionStatus: socketStatus.connected,
            channel,
            highlightedPostId,
            selectedPostFocusedAt,
            enableWebSocketEventScope,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            fetchRHSAppsBindings,
            getNewestPostThread,
            getPostThread,
            getThread: fetchThread,
            selectPostCard,
            updateThreadLastOpened,
            updateThreadRead,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ThreadViewer);
