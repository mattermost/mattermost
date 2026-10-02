// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getDirectTeammate, isMyChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

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

        // The thread selector includes the root. Drop it from the list when the caller already
        // shows that post, and keep it as lastPost when it is the only post so scrolling stays valid.
        const replyPostIds = hideRoot ? postIds.filter((id) => id !== selected.id) : postIds;
        const lastPost = getPost(state, replyPostIds[0] || postIds[0]);

        const replyListIds = getRepliesListWithSeparators(state, {
            postIds: replyPostIds,
            showDate: !useRelativeTimestamp,
            lastViewedAt: collapsedThreads ? lastViewedAt : undefined,
        });
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

const mapDispatchToProps = {
    measureRhsOpened,
};

export default connect(makeMapStateToProps, mapDispatchToProps)(ThreadViewerVirtualized);
