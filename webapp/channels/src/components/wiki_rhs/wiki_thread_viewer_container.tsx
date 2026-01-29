// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';
import type {ClientConfig} from '@mattermost/types/config';
import type {UserThread} from '@mattermost/types/threads';

import {fetchRHSAppsBindings} from 'mattermost-redux/actions/apps';
import {getNewestPostThread, getPostThread, getPost as fetchPost} from 'mattermost-redux/actions/posts';
import {getThread as fetchThread, updateThreadRead} from 'mattermost-redux/actions/threads';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {selectPostCard, openWikiRhs} from 'actions/views/rhs';
import {updateThreadLastOpened, updateThreadLastUpdateAt} from 'actions/views/threads';
import {getHighlightedPostId, getSelectedPostFocussedAt} from 'selectors/rhs';
import {getThreadLastUpdateAt} from 'selectors/views/threads';
import {getSocketStatus} from 'selectors/views/websocket';
import {makeGetFilteredPostIdsForWikiThread} from 'selectors/wiki_posts';
import {getFocusedInlineCommentId, getWikiRhsWikiId} from 'selectors/wiki_rhs';

import type {GlobalState} from 'types/store';

import WikiPageThreadViewer from './wiki_page_thread_viewer';

type OwnProps = {
    rootPostId: string;
    useRelativeTimestamp?: boolean;
    isThreadView: boolean;
    hideRootPost?: boolean;
};

function makeMapStateToProps() {
    // Use our filtering selector instead of the default getPostIdsForThread
    const getFilteredPostIds = makeGetFilteredPostIdsForWikiThread();
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
        const wikiId = getWikiRhsWikiId(state);
        const focusedInlineCommentId = getFocusedInlineCommentId(state);

        let postIds: string[] = [];
        let userThread: UserThread | null = null;
        let channel: Channel | undefined;
        let lastUpdateAt = 0;

        if (selected) {
            // When viewing a focused inline comment thread, use the comment ID as rootId
            // Otherwise use the page ID
            const threadRootId = focusedInlineCommentId || selected.id;

            postIds = getFilteredPostIds(state, threadRootId, focusedInlineCommentId);
            userThread = getThread(state, threadRootId);
            channel = getChannel(state, selected.channel_id);
            lastUpdateAt = getThreadLastUpdateAt(state, threadRootId);
        }

        const result = {
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
            lastUpdateAt,
            useRelativeTimestamp: ownProps.useRelativeTimestamp,
            isThreadView: ownProps.isThreadView,
            hideRootPost: ownProps.hideRootPost,
            focusedInlineCommentId: focusedInlineCommentId || null,
            wikiId: wikiId || null,
        };

        return result;
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            fetchRHSAppsBindings,
            getNewestPostThread,
            getPostThread,
            getPost: fetchPost,
            getThread: fetchThread,
            selectPostCard,
            updateThreadLastOpened,
            updateThreadRead,
            updateThreadLastUpdateAt,
            openWikiRhs,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(WikiPageThreadViewer);
