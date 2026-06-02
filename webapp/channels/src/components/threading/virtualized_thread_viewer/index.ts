// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getDirectTeammate, isMyChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled, getTimestampDisplayMode, shouldUseAbsoluteTimestamps} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {getTimestampDisplayProps} from 'components/timestamp/timestamp_display_props';

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
}

function makeMapStateToProps() {
    const getRepliesListWithSeparators = makePrepareReplyIdsForThreadViewer();
    const getThreadLastViewedAt = makeGetThreadLastViewedAt();

    return (state: GlobalState, ownProps: OwnProps) => {
        const {postIds, useRelativeTimestamp, selected, channelId} = ownProps;
        const useAbsoluteTimestamps = shouldUseAbsoluteTimestamps(state);
        const effectiveUseRelativeTimestamp = useRelativeTimestamp && !useAbsoluteTimestamps;
        const timeZone = getUserCurrentTimezone(getCurrentTimezoneFull(state));
        const displayProps = useAbsoluteTimestamps ?
            getTimestampDisplayProps(timeZone, getTimestampDisplayMode(state)) :
            undefined;

        const collapsedThreads = isCollapsedThreadsEnabled(state);
        const currentUserId = getCurrentUserId(state);
        const lastViewedAt = getThreadLastViewedAt(state, selected.id);
        const directTeammate = getDirectTeammate(state, channelId);

        const lastPost = getPost(state, postIds[0]);

        const replyListIds = getRepliesListWithSeparators(state, {
            postIds,
            showDate: !effectiveUseRelativeTimestamp,
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
            useRelativeTimestamp: effectiveUseRelativeTimestamp,
            customTimestampProps: displayProps,
        };
    };
}

const mapDispatchToProps = {
    measureRhsOpened,
};

export default connect(makeMapStateToProps, mapDispatchToProps)(ThreadViewerVirtualized);
