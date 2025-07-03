// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import {selectChannel} from 'mattermost-redux/actions/channels';
import {getPostThread} from 'mattermost-redux/actions/posts';
import {getThreadForCurrentUser} from 'mattermost-redux/actions/threads';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';

import type {GlobalState} from 'types/store';

import {usePost} from './common/hooks/usePost';
import ThreadPane from './threading/global_threads/thread_pane';
import ThreadViewer from './threading/thread_viewer';

export default function StandaloneThread() {
    const dispatch = useDispatch();

    const threadId = useParams<{threadId: string}>().threadId;

    useEffect(() => {
        if (document.body.classList.contains('app__body')) {
            return () => {};
        }

        document.body.classList.add('app__body');
        return () => {
            document.body.classList.remove('app__body');
        };
    }, []);

    const currentTeamId = useSelector(getCurrentTeamId);
    const [thread] = useThreadAndPosts(currentTeamId, threadId);

    const rootPost = usePost(threadId);

    const channelId = rootPost?.channel_id ?? '';
    useEffect(() => {
        dispatch(selectChannel(channelId));
    }, [dispatch, channelId]);

    if (!rootPost || !thread) {
        return null;
    }

    return (
        <div style={{gridArea: 'center', backgroundColor: 'var(--center-channel-bg)'}}>
            <ThreadPane
                thread={thread}
            >
                <ThreadViewer
                    rootPostId={threadId}
                    useRelativeTimestamp={true}
                    isThreadView={true}
                />
            </ThreadPane>
        </div>
    );
}

function useThreadAndPosts(teamId: string, threadId: string) {
    const dispatch = useDispatch();

    const thread = useSelector((state: GlobalState) => getThread(state, threadId));

    useEffect(() => {
        if (threadId && !thread) {
            dispatch(getThreadForCurrentUser(teamId, threadId));
        }
    }, [dispatch, teamId, threadId, thread]);

    const posts = useSelector((state: GlobalState) => getThread(state, threadId));

    useEffect(() => {
        dispatch(getPostThread(threadId, true, 0));
    }, [dispatch, threadId]);

    return [thread, posts];
}

