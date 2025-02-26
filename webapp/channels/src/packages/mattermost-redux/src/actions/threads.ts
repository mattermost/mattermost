// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import uniq from 'lodash/uniq';
import {batchActions} from 'redux-batched-actions';

import type {Post} from '@mattermost/types/posts';
import type {UserThread, UserThreadList} from '@mattermost/types/threads';

import {ThreadTypes, PostTypes, UserTypes} from 'mattermost-redux/action_types';
import {getMissingFilesByPosts} from 'mattermost-redux/actions/files';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import ThreadConstants from 'mattermost-redux/constants/threads';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {makeGetPostsForThread} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getThread as getThreadSelector, getThreadsInChannel} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {DispatchFunc, GetStateFunc, ActionFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {forceLogoutIfNecessary} from './helpers';
import {getPostThread} from './posts';
import {getMyTeamUnreads} from './teams';

type ExtendedPost = Post & { system_post_ids?: string[] };

export function fetchThreads(userId: string, teamId: string, {before = '', after = '', perPage = ThreadConstants.THREADS_CHUNK_SIZE, unread = false, totalsOnly = false, threadsOnly = false, extended = false, since = 0} = {}): ActionFuncAsync<UserThreadList> {
    return async (dispatch, getState) => {
        let data: undefined | UserThreadList;

        try {
            data = await Client4.getUserThreads(userId, teamId, {before, after, perPage, extended, unread, totalsOnly, threadsOnly, since});
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data};
    };
}

export function getThreadsForCurrentTeam({before = '', after = '', unread = false} = {}): ActionFuncAsync<UserThreadList> {
    return async (dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const teamId = getCurrentTeamId(getState());

        const response = await dispatch(fetchThreads(userId, teamId, {
            before,
            after,
            perPage: ThreadConstants.THREADS_PAGE_SIZE,
            unread,
            totalsOnly: false,
            threadsOnly: true,
            extended: true,
        }));

        if (response.error) {
            return response;
        }

        const userThreadList: undefined | UserThreadList = response?.data;

        if (!userThreadList) {
            return {error: true};
        }

        if (userThreadList?.threads?.length) {
            await dispatch(getMissingProfilesByIds(userThreadList.threads.map(({participants}) => participants.map(({id}) => id)).flat()));

            dispatch({
                type: PostTypes.RECEIVED_POSTS,
                data: {posts: userThreadList.threads.map(({post}) => ({...post, update_at: 0}))},
            });

            dispatch(getMissingFilesByPosts(uniq(userThreadList.threads.map(({post}) => post))));
        }

        dispatch({
            type: unread ? ThreadTypes.RECEIVED_UNREAD_THREADS : ThreadTypes.RECEIVED_THREADS,
            data: {
                threads: userThreadList?.threads?.map((thread) => ({...thread, is_following: true})) ?? [],
                team_id: teamId,
            },
        });

        return {data: userThreadList};
    };
}

export function getThreadCounts(userId: string, teamId: string): ActionFuncAsync {
    return async (dispatch) => {
        const response = await dispatch(fetchThreads(userId, teamId, {totalsOnly: true, threadsOnly: false}));

        if (response.error) {
            return response;
        }

        const counts: undefined | UserThreadList = response?.data;
        if (!counts) {
            return {error: true};
        }

        const data = {
            total: counts.total,
            total_unread_threads: counts.total_unread_threads,
            total_unread_mentions: counts.total_unread_mentions,
            total_unread_urgent_mentions: counts.total_unread_urgent_mentions,
        };

        dispatch({
            type: ThreadTypes.RECEIVED_THREAD_COUNTS,
            data: {
                ...data,
                team_id: teamId,
            },
        });

        return {data};
    };
}

export function getCountsAndThreadsSince(userId: string, teamId: string, since?: number): ActionFuncAsync {
    return async (dispatch) => {
        const response = await dispatch(fetchThreads(userId, teamId, {since, totalsOnly: false, threadsOnly: false, extended: true}));

        if (response.error) {
            return response;
        }

        const userThreadList: undefined | UserThreadList = response?.data;
        if (!userThreadList) {
            return {error: true};
        }

        const actions = [];

        if (userThreadList?.threads?.length) {
            await dispatch(getMissingProfilesByIds(userThreadList.threads.map(({participants}) => participants.map(({id}) => id)).flat()));
            actions.push({
                type: PostTypes.RECEIVED_POSTS,
                data: {posts: userThreadList.threads.map(({post}) => ({...post, update_at: 0}))},
            });
        }

        actions.push({
            type: ThreadTypes.RECEIVED_THREADS,
            data: {
                threads: userThreadList?.threads?.map((thread) => ({...thread, is_following: true})) ?? [],
                team_id: teamId,
            },
        });

        const counts = {
            total: userThreadList.total,
            total_unread_threads: userThreadList.total_unread_threads,
            total_unread_mentions: userThreadList.total_unread_mentions,
            total_unread_urgent_mentions: userThreadList.total_unread_urgent_mentions,
        };

        actions.push({
            type: ThreadTypes.RECEIVED_THREAD_COUNTS,
            data: {
                ...counts,
                team_id: teamId,
            },
        });

        dispatch(batchActions(actions));

        return {data: userThreadList};
    };
}

export function handleThreadArrived(dispatch: DispatchFunc, getState: GetStateFunc, threadData: UserThread, teamId: string, previousUnreadReplies?: number, previousUnreadMentions?: number) {
    const state = getState();
    const currentUserId = getCurrentUserId(state);
    const crtEnabled = isCollapsedThreadsEnabled(state);
    const thread = {...threadData, is_following: true};

    dispatch({
        type: UserTypes.RECEIVED_PROFILES_LIST,
        data: thread.participants.filter((user) => user.id !== currentUserId),
    });

    dispatch({
        type: PostTypes.RECEIVED_POST,
        data: {...thread.post, update_at: 0},
        features: {crtEnabled},
    });

    dispatch({
        type: ThreadTypes.RECEIVED_THREAD,
        data: {
            thread,
            team_id: teamId,
        },
    });

    const oldThreadData = state.entities.threads.threads[threadData.id];

    // update thread read if and only if we have previous unread values
    // upon receiving a thread.
    // we need that guard to ensure that fetching a thread won't skew the counts
    //
    // PS: websocket events should always provide the previous unread values
    if (
        (previousUnreadMentions != null && previousUnreadReplies != null) ||
        oldThreadData != null
    ) {
        dispatch(
            handleReadChanged(
                thread.id,
                teamId,
                thread.post.channel_id,
                {
                    lastViewedAt: thread.last_viewed_at,
                    prevUnreadMentions: oldThreadData?.unread_mentions ?? previousUnreadMentions,
                    newUnreadMentions: thread.unread_mentions,
                    prevUnreadReplies: oldThreadData?.unread_replies ?? previousUnreadReplies,
                    newUnreadReplies: thread.unread_replies,
                },
            ),
        );
    }

    return thread;
}

export function getThread(userId: string, teamId: string, threadId: string, extended = true): ActionFuncAsync {
    return async (dispatch, getState) => {
        let thread;
        try {
            thread = await Client4.getUserThread(userId, teamId, threadId, extended);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        if (thread) {
            thread = handleThreadArrived(dispatch, getState, thread, teamId);
        }

        return {data: thread};
    };
}

export function handleAllMarkedRead(teamId: string) {
    return {
        type: ThreadTypes.ALL_TEAM_THREADS_READ,
        data: {
            team_id: teamId,
        },
    };
}

export function markAllThreadsInTeamRead(userId: string, teamId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.updateThreadsReadForUser(userId, teamId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(handleAllMarkedRead(teamId));

        return {};
    };
}

export function markThreadAsUnread(userId: string, teamId: string, threadId: string, postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.markThreadAsUnreadForUser(userId, teamId, threadId, postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {};
    };
}

export function markLastPostInThreadAsUnread(userId: string, teamId: string, threadId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const getPostsForThread = makeGetPostsForThread();
        let posts = getPostsForThread(getState(), threadId);

        const state = getState();
        const thread = getThreadSelector(state, threadId);

        // load posts in thread if they are not loaded already
        if (thread?.reply_count === posts.length - 1) {
            dispatch(markThreadAsUnread(userId, teamId, threadId, posts[0].id));
        } else {
            dispatch(getPostThread(threadId)).then(({data, error}) => {
                if (data) {
                    posts = getPostsForThread(getState(), threadId);
                    dispatch(markThreadAsUnread(userId, teamId, threadId, posts[0].id));
                } else if (error) {
                    return {error};
                }
                return {};
            });
        }

        return {};
    };
}

export function updateThreadRead(userId: string, teamId: string, threadId: string, timestamp: number): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.updateThreadReadForUser(userId, teamId, threadId, timestamp);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {};
    };
}

export function handleReadChanged(
    threadId: string,
    teamId: string,
    channelId: string,
    {
        lastViewedAt,
        prevUnreadMentions,
        newUnreadMentions,
        prevUnreadReplies,
        newUnreadReplies,
    }: {
        lastViewedAt: number;
        prevUnreadMentions: number;
        newUnreadMentions: number;
        prevUnreadReplies: number;
        newUnreadReplies: number;
    },
): ActionFunc {
    return (dispatch, getState) => {
        const state = getState();
        const channel = getChannel(state, channelId);
        const thread = getThreadSelector(state, threadId);

        return dispatch({
            type: ThreadTypes.READ_CHANGED_THREAD,
            data: {
                id: threadId,
                teamId,
                channelId,
                lastViewedAt,
                prevUnreadMentions,
                newUnreadMentions,
                prevUnreadReplies,
                newUnreadReplies,
                channelType: channel?.type,
                isUrgent: thread?.is_urgent,
            },
        });
    };
}

export function handleFollowChanged(dispatch: DispatchFunc, threadId: string, teamId: string, following: boolean) {
    dispatch({
        type: ThreadTypes.FOLLOW_CHANGED_THREAD,
        data: {
            id: threadId,
            team_id: teamId,
            following,
        },
    });
}

export function setThreadFollow(userId: string, teamId: string, threadId: string, newState: boolean): ActionFuncAsync {
    return async (dispatch, getState) => {
        handleFollowChanged(dispatch, threadId, teamId, newState);

        try {
            await Client4.updateThreadFollowForUser(userId, teamId, threadId, newState);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        // As a short term fix for https://mattermost.atlassian.net/browse/MM-62113, we will fetch
        // the users team unreads after following or unfollowing a thread. This will ensure that the unreads are
        // updated correctly in the case where the user is following or unfollowing a thread that has unread messages.
        dispatch(getMyTeamUnreads(isCollapsedThreadsEnabled(getState())));

        return {};
    };
}

export function handleAllThreadsInChannelMarkedRead(channelId: string, lastViewedAt: number): ActionFunc<boolean> {
    return (dispatch, getState) => {
        const state = getState();

        const channel = getChannel(state, channelId);
        if (channel == null) {
            return {data: false};
        }

        const teamId = channel.team_id;
        const threadsInChannel = getThreadsInChannel(state, channelId);

        const actions = [];
        for (const thread of threadsInChannel) {
            actions.push({
                type: ThreadTypes.READ_CHANGED_THREAD,
                data: {
                    id: thread.id,
                    channelId,
                    teamId,
                    lastViewedAt,
                    newUnreadMentions: 0,
                    newUnreadReplies: 0,
                    isUrgent: thread.is_urgent,
                },
            });
        }

        dispatch(batchActions(actions));

        return {data: true};
    };
}

export function decrementThreadCounts(post: ExtendedPost): ActionFunc {
    return (dispatch, getState) => {
        const state = getState();
        const thread = getThreadSelector(state, post.id);

        if (!thread || (!thread.unread_replies && !thread.unread_mentions)) {
            return {data: false};
        }

        const channel = getChannel(state, post.channel_id);
        const teamId = channel?.team_id || getCurrentTeamId(state);

        if (channel) {
            dispatch({
                type: ThreadTypes.DECREMENT_THREAD_COUNTS,
                teamId,
                replies: thread.unread_replies,
                mentions: thread.unread_mentions,
                channelType: channel.type,
            });
        }

        return {data: true};
    };
}
