// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {ClientConfig} from '@mattermost/types/config';
import type {UserThread} from '@mattermost/types/threads';

import {fetchRHSAppsBindings} from 'mattermost-redux/actions/apps';
import {getNewestPostThread} from 'mattermost-redux/actions/posts';
import {getThread as fetchThread, updateThreadRead} from 'mattermost-redux/actions/threads';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPageById} from 'mattermost-redux/selectors/entities/pages';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {fetchPage, getPageComments} from 'actions/pages';
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

    return function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
        const currentUserId = getCurrentUserId(state);
        const currentTeamId = getCurrentTeamId(state);
        const selected = getPageById(state, ownProps.rootPostId);
        const socketStatus = getSocketStatus(state);
        const highlightedPostId = getHighlightedPostId(state);
        const selectedPostFocusedAt = getSelectedPostFocussedAt(state);
        const config: Partial<ClientConfig> = getConfig(state);
        const enableWebSocketEventScope = config.FeatureFlagWebSocketEventScope === 'true';
        const wikiId = getWikiRhsWikiId(state);
        const focusedInlineCommentId = getFocusedInlineCommentId(state);

        let postIds: string[] = [];
        let userThread: UserThread | null = null;
        let lastUpdateAt = 0;

        if (selected) {
            // Always pass the page ID so the selector reads from commentsByPageId[pageId].
            // The focusedInlineCommentId is passed separately for filtering within that list.
            postIds = getFilteredPostIds(state, selected.id, focusedInlineCommentId);
            userThread = getThread(state, selected.id);
            lastUpdateAt = getThreadLastUpdateAt(state, selected.id);
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
            getPageComments,
            fetchPage,
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
