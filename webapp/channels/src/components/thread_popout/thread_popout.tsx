// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {defineMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';

import {fetchChannelsAndMembers, selectChannel} from 'mattermost-redux/actions/channels';
import {getPostThread} from 'mattermost-redux/actions/posts';
import {fetchTeamScheduledPosts} from 'mattermost-redux/actions/scheduled_posts';
import {extractUserIdsAndMentionsFromPosts} from 'mattermost-redux/actions/status_profile_polling';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getThread} from 'mattermost-redux/actions/threads';
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import {getChannel, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeamByName} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {loadStatusesByIds} from 'actions/status_actions';
import {markThreadAsRead} from 'actions/views/threads';

import {usePost} from 'components/common/hooks/usePost';
import {useUser} from 'components/common/hooks/useUser';
import ThreadPane from 'components/threading/global_threads/thread_pane';
import ThreadViewer from 'components/threading/thread_viewer';
import UnreadsStatusHandler from 'components/unreads_status_handler';

import {Constants} from 'utils/constants';
import usePopoutTitle from 'utils/popouts/use_popout_title';
import {isDesktopApp} from 'utils/user_agent';

import type {GlobalState} from 'types/store';

const THREAD_POPOUT_TITLE = defineMessage({
    id: 'thread_popout.title',
    // eslint-disable-next-line formatjs/enforce-placeholders -- provided later
    defaultMessage: 'Thread - {channelName} - {teamName} - {serverName}',
});
const THREAD_POPOUT_TITLE_DM = defineMessage({
    id: 'thread_popout.title.dm',
    // eslint-disable-next-line formatjs/enforce-placeholders -- provided later
    defaultMessage: 'Thread - {channelName} - {serverName}',
});
export function getThreadPopoutTitle(channel?: Channel) {
    return channel?.type === 'D' || channel?.type === 'G' ? THREAD_POPOUT_TITLE_DM : THREAD_POPOUT_TITLE;
}

export default function ThreadPopout() {
    const dispatch = useDispatch();
    const getThreadOrSynthetic = useMemo(() => makeGetThreadOrSynthetic(), []);

    const {postId, team: teamName} = useParams<{team: string; postId: string}>();
    const currentUserId = useSelector(getCurrentUserId);

    const post = usePost(postId);
    const team = useSelector((state: GlobalState) => getTeamByName(state, teamName));
    const channel = useSelector((state: GlobalState) => getChannel(state, post?.channel_id ?? ''));
    const currentChannel = useSelector(getCurrentChannel);
    useUser(currentChannel?.type === Constants.DM_CHANNEL && currentChannel.teammate_id ? currentChannel.teammate_id : '');
    const thread = useSelector((state: GlobalState) => {
        if (!post) {
            return undefined;
        }
        return getThreadOrSynthetic(state, post);
    });

    usePopoutTitle(getThreadPopoutTitle(channel));

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
            dispatch(fetchTeamScheduledPosts(teamId, true));
            dispatch(selectTeam(teamId));
        }
    }, [dispatch, teamId]);

    useEffect(() => {
        if (teamId) {
            dispatch(getThread(currentUserId, teamId, postId));

            // Since the statuses are fetched properly and timely by the thread viewer, manually fetch them here
            async function fetchPostThread() {
                const {data: posts} = await dispatch(getPostThread(postId, true));
                if (posts) {
                    const {data: result} = await dispatch(extractUserIdsAndMentionsFromPosts(Array.from(Object.values(posts.posts))));
                    if (result) {
                        if (result.userIdsForProfilePoll.length > 0) {
                            await dispatch(getProfilesByIds(result.userIdsForProfilePoll));
                        }
                        if (result.userIdsForStatusPoll.length > 0) {
                            await dispatch(loadStatusesByIds(result.userIdsForStatusPoll));
                        }
                    }
                }
            }

            fetchPostThread();
        }
    }, [postId, dispatch, currentUserId, teamId]);

    useEffect(() => {
        function handleFocus() {
            window.isActive = true;
            dispatch(markThreadAsRead(postId));
        }
        function handleBlur() {
            window.isActive = false;
        }
        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    if (!thread) {
        return null;
    }

    return (
        <>
            {isDesktopApp() && <UnreadsStatusHandler/>}
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
