// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {ThreadsState, UserThread} from '@mattermost/types/threads';
import type {UserProfile} from '@mattermost/types/users';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {ChannelTypes, PostTypes, ThreadTypes, UserTypes} from 'mattermost-redux/action_types';

import {countsReducer, countsIncludingDirectReducer} from './counts';
import {threadsInTeamReducer, unreadThreadsInTeamReducer} from './threadsInTeam';
import type {ExtraData} from './types';

export const threadsReducer = (state: ThreadsState['threads'] = {}, action: MMReduxAction, extra: ExtraData) => {
    switch (action.type) {
    case ThreadTypes.RECEIVED_UNREAD_THREADS:
    case ThreadTypes.RECEIVED_THREADS: {
        const {threads} = action.data;
        return {
            ...state,
            ...threads.reduce((results: IDMappedObjects<UserThread>, thread: UserThread) => {
                results[thread.id] = thread;
                return results;
            }, {}),
        };
    }
    case PostTypes.POST_DELETED:
    case PostTypes.POST_REMOVED: {
        const post = action.data;

        if (post.root_id || !state[post.id]) {
            return state;
        }

        const nextState = {...state};
        Reflect.deleteProperty(nextState, post.id);

        return nextState;
    }
    case ThreadTypes.RECEIVED_THREAD: {
        const {thread} = action.data;
        return {
            ...state,
            [thread.id]: thread,
        };
    }
    case ThreadTypes.READ_CHANGED_THREAD: {
        const {
            id,
            newUnreadMentions,
            newUnreadReplies,
            lastViewedAt,
        } = action.data;

        return {
            ...state,
            [id]: {
                ...(state[id] || {}),
                last_viewed_at: lastViewedAt,
                unread_mentions: newUnreadMentions,
                unread_replies: newUnreadReplies,
                is_following: true,
            },
        };
    }
    case ThreadTypes.FOLLOW_CHANGED_THREAD: {
        const {id, following} = action.data;

        if (!state[id]) {
            return state;
        }

        return {
            ...state,
            [id]: {
                ...state[id],
                is_following: following,
            },
        };
    }
    case PostTypes.RECEIVED_NEW_POST: {
        const post: Post = action.data;
        const thread: UserThread | undefined = state[post.root_id];
        if (post.root_id && thread) {
            const participants = thread.participants || [];
            const nextThread = {...thread};
            if (!participants.find((user: UserProfile | {id: string}) => user.id === post.user_id)) {
                nextThread.participants = [...participants, {id: post.user_id}];
            }

            if (post.reply_count) {
                nextThread.reply_count = post.reply_count;
            }

            return {
                ...state,
                [post.root_id]: nextThread,
            };
        }
        return state;
    }
    case ThreadTypes.ALL_TEAM_THREADS_READ: {
        return Object.entries(state).reduce<ThreadsState['threads']>((newState, [id, thread]) => {
            newState[id] = {
                ...thread,
                unread_mentions: 0,
                unread_replies: 0,
            };
            return newState;
        }, {});
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.LEAVE_CHANNEL: {
        if (!extra.threadsToDelete || extra.threadsToDelete.length === 0) {
            return state;
        }

        let threadDeleted = false;

        // Remove entries for any thread in the channel
        const nextState = {...state};
        for (const thread of extra.threadsToDelete) {
            Reflect.deleteProperty(nextState, thread.id);
            threadDeleted = true;
        }

        if (!threadDeleted) {
            // Nothing was actually removed
            return state;
        }

        return nextState;
    }
    }

    return state;
};

function getThreadsOfChannel(threads: ThreadsState['threads'], channelId: string) {
    const channelThreads: UserThread[] = [];
    for (const rootId of Object.keys(threads)) {
        if (
            threads[rootId] &&
            threads[rootId].post &&
            threads[rootId].post.channel_id === channelId
        ) {
            channelThreads.push(threads[rootId]);
        }
    }

    return channelThreads;
}

const initialState = {
    threads: {},
    threadsInTeam: {},
    unreadThreadsInTeam: {},
    counts: {},
    countsIncludingDirect: {},
};

// custom combineReducers function
// enables passing data between reducers
function reducer(state: ThreadsState = initialState, action: MMReduxAction): ThreadsState {
    const extra: ExtraData = {
        threads: state.threads,
    };

    // acting as a 'middleware'
    if (
        action.type === ChannelTypes.LEAVE_CHANNEL ||
        action.type === ChannelTypes.RECEIVED_CHANNEL_DELETED
    ) {
        if (!action.data.viewArchivedChannels) {
            extra.threadsToDelete = getThreadsOfChannel(state.threads, action.data.id);
        }
    }

    const nextState = {

        // Object mapping thread ids to thread objects
        threads: threadsReducer(state.threads, action, extra),

        // Object mapping teams ids to thread ids
        threadsInTeam: threadsInTeamReducer(state.threadsInTeam, action, extra),

        // Object mapping teams ids to unread thread ids
        unreadThreadsInTeam: unreadThreadsInTeamReducer(state.unreadThreadsInTeam, action, extra),

        // Object mapping teams ids to unread counts without DM/GM
        counts: countsReducer(state.counts, action, extra),

        // Object mapping teams ids to unread counts including direct channels
        countsIncludingDirect: countsIncludingDirectReducer(state.countsIncludingDirect, action, extra),
    };

    if (
        state.threads === nextState.threads &&
        state.threadsInTeam === nextState.threadsInTeam &&
        state.unreadThreadsInTeam === nextState.unreadThreadsInTeam &&
        state.counts === nextState.counts &&
        state.countsIncludingDirect === nextState.countsIncludingDirect
    ) {
        // None of the children have changed so don't even let the parent object change
        return state;
    }

    return nextState;
}

export default reducer;
