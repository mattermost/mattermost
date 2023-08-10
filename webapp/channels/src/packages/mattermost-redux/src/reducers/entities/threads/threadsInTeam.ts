// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes, PostTypes, TeamTypes, ThreadTypes, UserTypes} from 'mattermost-redux/action_types';

import type {ExtraData} from './types';
import type {Team} from '@mattermost/types/teams';
import type {ThreadsState, UserThread} from '@mattermost/types/threads';
import type {IDMappedObjects, RelationOneToMany} from '@mattermost/types/utilities';
import type {GenericAction} from 'mattermost-redux/types/actions';

type State = ThreadsState['threadsInTeam'] | ThreadsState['unreadThreadsInTeam'];

// return true only if it's 'newer' than other threads
// older threads will be added by scrolling so no need to manually add.
// furthermore manually adding older thread will BREAK pagination
function shouldAddThreadId(ids: Array<UserThread['id']>, thread: UserThread, threads: IDMappedObjects<UserThread>) {
    return ids.some((id) => {
        const t = threads![id];
        return thread.last_reply_at > t.last_reply_at;
    });
}

function handlePostRemoved(state: State, action: GenericAction): State {
    const post = action.data;
    if (post.root_id) {
        return state;
    }

    const teams = Object.keys(state).
        filter((id) => state[id].indexOf(post.id) !== -1);

    if (!teams?.length) {
        return state;
    }

    const teamState: RelationOneToMany<Team, UserThread> = {};

    for (let i = 0; i < teams.length; i++) {
        const teamId = teams[i];
        const index = state[teamId].indexOf(post.id);

        teamState[teamId] = [
            ...state[teamId].slice(0, index),
            ...state[teamId].slice(index + 1),
        ];
    }

    return {
        ...state,
        ...teamState,
    };
}

// adds thread to all teams in state
function handleAllTeamsReceivedThread(state: State, thread: UserThread, teamId: Team['id'], extra: ExtraData) {
    const teamIds = Object.keys(state);

    let newState = {...state};
    for (const teamId of teamIds) {
        newState = handleSingleTeamReceivedThread(newState, thread, teamId, extra);
    }

    return newState;
}

// adds thread to single team
function handleSingleTeamReceivedThread(state: State, thread: UserThread, teamId: Team['id'], extra: ExtraData) {
    const nextSet = new Set(state[teamId] || []);

    // thread exists in state
    if (nextSet.has(thread.id)) {
        return state;
    }

    // check if thread is newer than any of the existing threads
    const shouldAdd = shouldAddThreadId([...nextSet], thread, extra.threads);

    if (shouldAdd) {
        nextSet.add(thread.id);

        return {
            ...state,
            [teamId]: [...nextSet],
        };
    }

    return state;
}

export function handleReceivedThread(state: State, action: GenericAction, extra: ExtraData) {
    const {thread, team_id: teamId} = action.data;

    if (!teamId) {
        return handleAllTeamsReceivedThread(state, thread, teamId, extra);
    }

    return handleSingleTeamReceivedThread(state, thread, teamId, extra);
}

// add the thread only if it's 'newer' than other threads
// older threads will be added by scrolling so no need to manually add.
// furthermore manually adding older thread will BREAK pagination
export function handleFollowChanged(state: State, action: GenericAction, extra: ExtraData) {
    const {id, team_id: teamId, following} = action.data;
    const nextSet = new Set(state[teamId] || []);

    const thread = extra.threads[id];

    if (!thread) {
        return state;
    }

    // thread exists in state
    if (nextSet.has(id)) {
        // remove it if we unfollowed
        if (!following) {
            nextSet.delete(id);
            return {
                ...state,
                [teamId]: [...nextSet],
            };
        }
        return state;
    }

    // check if thread is newer than any of the existing threads
    const shouldAdd = shouldAddThreadId([...nextSet], thread, extra.threads);

    if (shouldAdd && following) {
        nextSet.add(thread.id);

        return {
            ...state,
            [teamId]: [...nextSet],
        };
    }

    return state;
}

function handleReceiveThreads(state: State, action: GenericAction) {
    const nextSet = new Set(state[action.data.team_id] || []);

    action.data.threads.forEach((thread: UserThread) => {
        nextSet.add(thread.id);
    });

    return {
        ...state,
        [action.data.team_id]: [...nextSet],
    };
}

function handleLeaveChannel(state: State, action: GenericAction, extra: ExtraData) {
    if (!extra.threadsToDelete || extra.threadsToDelete.length === 0) {
        return state;
    }

    const teamId = action.data.team_id;

    let threadDeleted = false;

    // Remove entries for any thread in the channel
    const nextState = {...state};
    for (const thread of extra.threadsToDelete) {
        if (nextState[teamId]) {
            const index = nextState[teamId].indexOf(thread.id);
            if (index !== -1) {
                nextState[teamId] = [...nextState[teamId].slice(0, index), ...nextState[teamId].slice(index + 1)];
                threadDeleted = true;
            }
        }
    }

    if (!threadDeleted) {
        // Nothing was actually removed
        return state;
    }

    return nextState;
}

function handleLeaveTeam(state: State, action: GenericAction) {
    const team: Team = action.data;

    if (!state[team.id]) {
        return state;
    }

    const nextState = {...state};
    Reflect.deleteProperty(nextState, team.id);

    return nextState;
}

function handleSingleTeamThreadRead(state: ThreadsState['unreadThreadsInTeam'], action: GenericAction, teamId: string, extra: ExtraData) {
    const {
        id,
        newUnreadMentions,
        newUnreadReplies,
    } = action.data;
    const team = state[teamId] || [];
    const index = team.indexOf(id);

    // the thread is not in the unread list
    if (index === -1) {
        const thread = extra.threads[id];

        // the thread is unread
        if (thread && (newUnreadReplies > 0 || newUnreadMentions > 0)) {
            // if it's newer add it, we don't care about ordering here since we order on the selector
            if (shouldAddThreadId(team, thread, extra.threads)) {
                return {
                    ...state,
                    [teamId]: [
                        ...team,
                        id,
                    ],
                };
            }
        }

        // do nothing when the thread is read
        return state;
    }

    // do nothing when the thread exists and it's unread
    if (newUnreadReplies > 0 || newUnreadMentions > 0) {
        return state;
    }

    // if the thread is read remove it
    return {
        ...state,
        [teamId]: [
            ...team.slice(0, index),
            ...team.slice(index + 1),
        ],
    };
}

export const threadsInTeamReducer = (state: ThreadsState['threadsInTeam'] = {}, action: GenericAction, extra: ExtraData) => {
    switch (action.type) {
    case ThreadTypes.RECEIVED_THREAD:
        return handleReceivedThread(state, action, extra);
    case PostTypes.POST_REMOVED:
        return handlePostRemoved(state, action);
    case ThreadTypes.RECEIVED_THREADS:
        return handleReceiveThreads(state, action);
    case TeamTypes.LEAVE_TEAM:
        return handleLeaveTeam(state, action);
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.LEAVE_CHANNEL:
        return handleLeaveChannel(state, action, extra);
    }

    return state;
};

export const unreadThreadsInTeamReducer = (state: ThreadsState['unreadThreadsInTeam'] = {}, action: GenericAction, extra: ExtraData) => {
    switch (action.type) {
    case ThreadTypes.READ_CHANGED_THREAD: {
        const {teamId} = action.data;
        if (teamId === '') {
            const teamIds = Object.keys(state);

            let newState = {...state};
            for (const teamId of teamIds) {
                newState = handleSingleTeamThreadRead(newState, action, teamId, extra);
            }
            return newState;
        }

        return handleSingleTeamThreadRead(state, action, teamId, extra);
    }
    case ThreadTypes.RECEIVED_THREAD:
        if (action.data.thread.unread_replies > 0 || action.data.thread.unread_mentions > 0) {
            return handleReceivedThread(state, action, extra);
        }
        return state;
    case PostTypes.POST_REMOVED:
        return handlePostRemoved(state, action);
    case ThreadTypes.RECEIVED_UNREAD_THREADS:
        return handleReceiveThreads(state, action);
    case TeamTypes.LEAVE_TEAM:
        return handleLeaveTeam(state, action);
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.LEAVE_CHANNEL:
        return handleLeaveChannel(state, action, extra);
    case ThreadTypes.FOLLOW_CHANGED_THREAD:
        return handleFollowChanged(state, action, extra);
    }
    return state;
};
