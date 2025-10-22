// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import type {GlobalState} from '@mattermost/types/store';

import {fetchChannelsAndMembers, selectChannel} from 'mattermost-redux/actions/channels';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getThread} from 'mattermost-redux/actions/threads';
import {getTeamByName} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {usePost} from 'components/common/hooks/usePost';
import ThreadPane from 'components/threading/global_threads/thread_pane';
import ThreadViewer from 'components/threading/thread_viewer';
import UnreadsStatusHandler from 'components/unreads_status_handler';

export default function ThreadPopout() {
    const dispatch = useDispatch();
    const getThreadOrSynthetic = useMemo(() => makeGetThreadOrSynthetic(), []);

    const {postId, team: teamName} = useParams<{team: string; postId: string}>();
    const currentUserId = useSelector(getCurrentUserId);

    const post = usePost(postId);
    const team = useSelector((state: GlobalState) => getTeamByName(state, teamName));
    const thread = useSelector((state: GlobalState) => {
        if (!post) {
            return undefined;
        }
        return getThreadOrSynthetic(state, post);
    });

    const channelId = post?.channel_id;
    useEffect(() => {
        if (channelId) {
            dispatch(selectChannel(channelId));
        }
    }, [dispatch, channelId]);

    const teamId = team?.id;
    useEffect(() => {
        if (teamId) {
            dispatch(fetchChannelsAndMembers(teamId));
            dispatch(selectTeam(teamId));
        }
    }, [dispatch, teamId]);

    useEffect(() => {
        if (teamId) {
            dispatch(getThread(currentUserId, teamId, postId));
        }
    }, [postId, dispatch, currentUserId, teamId]);

    if (!thread) {
        return null;
    }

    return (
        <>
            <UnreadsStatusHandler/>
            <ThreadPane
                thread={thread}
            >
                <ThreadViewer
                    rootPostId={postId}
                    useRelativeTimestamp={true}
                    isThreadView={true}
                />
            </ThreadPane>
        </>
    );
}
