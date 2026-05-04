// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';

import {isPostPendingOrFailed} from 'mattermost-redux/utils/post_utils';

import {closeRightHandSide} from 'actions/views/rhs';

import RhsHeaderPost from 'components/rhs_header_post';
import RhsPostPropertiesPanel from 'components/rhs_post_properties_panel';
import ThreadViewer from 'components/threading/thread_viewer';

import * as PostUtils from 'utils/post_utils';

import type {FakePost, RhsState} from 'types/store/rhs';

type Props = {
    currentTeam?: Team;
    channel?: Channel;
    selected: Post | FakePost;
    previousRhsState?: RhsState;
}

const RhsThread = ({
    currentTeam,
    channel,
    selected,
    previousRhsState,
}: Props) => {
    const dispatch = useDispatch();

    useEffect(() => {
        if (channel?.team_id && channel.team_id !== currentTeam?.id) {
            // if team-scoped and mismatched team, close rhs
            dispatch(closeRightHandSide());
        }
    }, [currentTeam, channel, dispatch]);

    if (selected == null || !channel) {
        return (
            <div/>
        );
    }

    const realPost = (selected as Post);
    const showPropertiesPanel =
        Boolean(realPost.channel_id) &&
        !PostUtils.isSystemMessage(realPost) &&
        !isPostPendingOrFailed(realPost);

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <RhsHeaderPost
                rootPostId={selected.id}
                channel={channel}
                previousRhsState={previousRhsState}
            />
            {showPropertiesPanel && (
                <RhsPostPropertiesPanel
                    postId={selected.id}
                    channelId={realPost.channel_id}
                />
            )}
            <ThreadViewer
                rootPostId={selected.id}
                useRelativeTimestamp={true}
                isThreadView={false}
            />
        </div>
    );
};

export default memo(RhsThread);

