// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getDirectTeammate, isMyChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {isDateLine} from 'mattermost-redux/utils/post_list';

import {measureRhsOpened} from 'actions/views/rhs';
import {getIsMobileView} from 'selectors/views/browser';
import {makePrepareReplyIdsForThreadViewer, makeGetThreadLastViewedAt} from 'selectors/views/threads';

import type {GlobalState} from 'types/store';
import type {FakePost} from 'types/store/rhs';

import ThreadViewerVirtualized from './virtualized_thread_viewer';

type OwnProps = {
    channelId: string;
    postIds: Array<Post['id'] | FakePost['id']>;
    selected: Post | FakePost;
    useRelativeTimestamp: boolean;
    onCardClick: (post: Post) => void;
    hideRoot?: boolean;
};

function makeMapStateToProps() {
    const getRepliesListWithSeparators = makePrepareReplyIdsForThreadViewer();
    const getThreadLastViewedAt = makeGetThreadLastViewedAt();

    return (state: GlobalState, ownProps: OwnProps) => {
        const {postIds, useRelativeTimestamp, selected, channelId, hideRoot} = ownProps;

        const collapsedThreads = isCollapsedThreadsEnabled(state);
        const currentUserId = getCurrentUserId(state);
        const lastViewedAt = getThreadLastViewedAt(state, selected.id);
        const directTeammate = getDirectTeammate(state, channelId);

        // postIds is newest-first and includes the root. The separator selector skips its oldest
        // post, so the root has to stay in that list or the first unread reply loses its
        // new-messages line. Drop the root afterwards when the caller already shows it.
        const replyPostIds = hideRoot ? postIds.filter((id) => id !== selected.id) : postIds;
        const lastPost = getPost(state, replyPostIds[0] || postIds[0]);

        const preparedIds = getRepliesListWithSeparators(state, {
            postIds,
            showDate: !useRelativeTimestamp,
            lastViewedAt: collapsedThreads ? lastViewedAt : undefined,
        });
        const replyListIds = hideRoot ? withoutRoot(preparedIds, selected.id) : preparedIds;
        const newMessagesSeparatorActions = state.plugins.components.NewMessagesSeparatorAction;

        return {
            currentUserId,
            directTeammate,
            isMobileView: getIsMobileView(state),
            lastPost,
            replyListIds,
            newMessagesSeparatorActions,
            isChannelAutotranslated: isMyChannelAutotranslated(state, channelId),
        };
    };
}

// The root is the oldest post, so the date line that belongs only to it is the last id.
export function withoutRoot(ids: string[], rootId: string): string[] {
    const withoutRootId = ids.filter((id) => id !== rootId);
    const last = withoutRootId[withoutRootId.length - 1];
    const beforeLast = withoutRootId[withoutRootId.length - 2];
    if (last && isDateLine(last) && (!beforeLast || isDateLine(beforeLast))) {
        return withoutRootId.slice(0, -1);
    }
    return withoutRootId;
}

const mapDispatchToProps = {
    measureRhsOpened,
};

export default connect(makeMapStateToProps, mapDispatchToProps)(ThreadViewerVirtualized);
