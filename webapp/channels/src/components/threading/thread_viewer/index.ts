// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getPost, makeGetPostIdsForThread} from 'mattermost-redux/selectors/entities/posts';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';

import {removePost, getNewestPostThread, getPostThread} from 'mattermost-redux/actions/posts';
import {getThread as fetchThread, updateThreadRead} from 'mattermost-redux/actions/threads';

import {GenericAction} from 'mattermost-redux/types/actions';
import {UserThread} from '@mattermost/types/threads';
import {Channel} from '@mattermost/types/channels';

import {getSocketStatus} from 'selectors/views/websocket';
import {selectPostCard} from 'actions/views/rhs';
import {getHighlightedPostId, getSelectedPostFocussedAt} from 'selectors/rhs';
import {updateThreadLastOpened} from 'actions/views/threads';
import {GlobalState} from 'types/store';

import {fetchRHSAppsBindings} from 'mattermost-redux/actions/apps';

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
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            fetchRHSAppsBindings,
            getNewestPostThread,
            getPostThread,
            getThread: fetchThread,
            removePost,
            selectPostCard,
            updateThreadLastOpened,
            updateThreadRead,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ThreadViewer);
