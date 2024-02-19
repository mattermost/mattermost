// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Channel} from '@mattermost/types/channels';
import type {Team, TeamUnread} from '@mattermost/types/teams';
import type {ThreadsState, UserThread} from '@mattermost/types/threads';

import {ChannelTypes, TeamTypes, ThreadTypes, UserTypes} from 'mattermost-redux/action_types';
import {General} from 'mattermost-redux/constants';

import type {ExtraData} from './types';

function isDmGmChannel(channelType: Channel['type']) {
    return channelType === General.DM_CHANNEL || channelType === General.GM_CHANNEL;
}

function handleAllTeamThreadsRead(state: ThreadsState['counts'], action: AnyAction): ThreadsState['counts'] {
    const counts = state[action.data.team_id] ?? {};
    return {
        ...state,
        [action.data.team_id]: {
            ...counts,
            total_unread_mentions: 0,
            total_unread_threads: 0,
            total_unread_urgent_mentions: 0,
        },
    };
}

function isEqual(state: ThreadsState['counts'], action: AnyAction, unreads: boolean) {
    const counts = state[action.data.team_id] ?? {};

    const {
        total,
        total_unread_threads: totalUnreadThreads,
        total_unread_mentions: totalUnreadMentions,
        total_unread_urgent_mentions: totalUnreadUrgentMentions,
    } = action.data;

    if (
        totalUnreadMentions !== counts.total_unread_mentions ||
        totalUnreadThreads !== counts.total_unread_threads ||
        totalUnreadUrgentMentions !== counts.total_unread_urgent_mentions
    ) {
        return false;
    }

    // in unread threads we exclude saving the total number,
    // since it doesn't reflect the actual total of threads
    // but only the total of unread threads
    if (!unreads && total !== counts.total) {
        return false;
    }

    return true;
}

function handleReadChangedThread(state: ThreadsState['counts'], action: AnyAction, teamId: string, isUrgent: boolean): ThreadsState['counts'] {
    const {
        prevUnreadMentions = 0,
        newUnreadMentions = 0,
        prevUnreadReplies = 0,
        newUnreadReplies = 0,
    } = action.data;
    const counts = state[teamId] ? {
        ...state[teamId],
    } : {
        total_unread_threads: prevUnreadReplies,
        total: 0,
        total_unread_mentions: prevUnreadMentions,
        total_unread_urgent_mentions: isUrgent ? prevUnreadMentions : 0,
    };

    const unreadMentionDiff = newUnreadMentions - prevUnreadMentions;

    counts.total_unread_mentions = Math.max(counts.total_unread_mentions + unreadMentionDiff, 0);
    if (isUrgent) {
        counts.total_unread_urgent_mentions = Math.max(counts.total_unread_urgent_mentions + unreadMentionDiff, 0);
    }

    if (newUnreadReplies > 0 && prevUnreadReplies === 0) {
        counts.total_unread_threads += 1;
    } else if (prevUnreadReplies > 0 && newUnreadReplies === 0) {
        counts.total_unread_threads = Math.max(counts.total_unread_threads - 1, 0);
    }

    return {
        ...state,
        [teamId]: counts,
    };
}

function handleLeaveTeam(state: ThreadsState['counts'], action: AnyAction): ThreadsState['counts'] {
    const team: Team = action.data;

    if (!state[team.id]) {
        return state;
    }

    const nextState = {...state};
    Reflect.deleteProperty(nextState, team.id);

    return nextState;
}

function handleLeaveChannel(state: ThreadsState['counts'] = {}, action: AnyAction, extra: ExtraData) {
    if (!extra.threadsToDelete || extra.threadsToDelete.length === 0) {
        return state;
    }

    const teamId = action.data.team_id;

    if (!teamId || !state[teamId]) {
        return state;
    }

    const {unreadMentions, unreadThreads, unreadUrgentMentions} = extra.threadsToDelete.reduce((curr, item: UserThread) => {
        curr.unreadMentions += item.unread_mentions;
        curr.unreadThreads = item.unread_replies > 0 ? curr.unreadThreads + 1 : curr.unreadThreads;
        curr.unreadUrgentMentions = item.is_urgent ? curr.unreadUrgentMentions + item.unread_mentions : curr.unreadUrgentMentions;
        return curr;
    }, {unreadMentions: 0, unreadThreads: 0, unreadUrgentMentions: 0});

    const {total, total_unread_mentions: totalUnreadMentions, total_unread_threads: totalUnreadThreads, total_unread_urgent_mentions: totalUnreadUrgentMentions} = state[teamId];

    return {
        ...state,
        [teamId]: {
            total: Math.max(total - extra.threadsToDelete.length, 0),
            total_unread_mentions: Math.max(totalUnreadMentions - unreadMentions, 0),
            total_unread_threads: Math.max(totalUnreadThreads - unreadThreads, 0),
            total_unread_urgent_mentions: Math.max((totalUnreadUrgentMentions || 0) - unreadUrgentMentions, 0),
        },
    };
}

function handleDecrementThreadCounts(state: ThreadsState['counts'], action: AnyAction) {
    const {teamId, replies, mentions} = action;
    const counts = state[teamId];
    if (!counts) {
        return state;
    }

    return {
        ...state,
        [teamId]: {
            total: Math.max(counts.total - 1, 0),
            total_unread_mentions: Math.max(counts.total_unread_mentions - mentions, 0),
            total_unread_threads: Math.max(counts.total_unread_threads - replies, 0),
        },
    };
}

export function countsIncludingDirectReducer(state: ThreadsState['counts'] = {}, action: AnyAction, extra: ExtraData) {
    switch (action.type) {
    case ThreadTypes.ALL_TEAM_THREADS_READ:
        return handleAllTeamThreadsRead(state, action);
    case ThreadTypes.READ_CHANGED_THREAD: {
        const {teamId, channelType, isUrgent} = action.data;
        if (isDmGmChannel(channelType)) {
            const teamIds = new Set(Object.keys(state));

            // if the case of dm/gm make sure we add counts for all teams
            if (teamId !== '') {
                teamIds.add(teamId);
            }

            let newState = {...state};
            teamIds.forEach((id) => {
                newState = handleReadChangedThread(newState, action, id, isUrgent);
            });

            return newState;
        }

        return handleReadChangedThread(state, action, teamId, isUrgent);
    }
    case ThreadTypes.FOLLOW_CHANGED_THREAD: {
        const {team_id: teamId, following} = action.data;
        const counts = state[teamId];

        if (counts?.total == null) {
            return state;
        }

        return {
            ...state,
            [teamId]: {
                ...counts,
                total: following ? counts.total + 1 : counts.total - 1,
            },
        };
    }
    case TeamTypes.LEAVE_TEAM:
        return handleLeaveTeam(state, action);
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.LEAVE_CHANNEL:
        return handleLeaveChannel(state, action, extra);
    case ThreadTypes.RECEIVED_THREAD_COUNTS:
        if (isEqual(state, action, false)) {
            return state;
        }

        return {
            ...state,
            [action.data.team_id]: {
                total: action.data.total,
                total_unread_threads: action.data.total_unread_threads,
                total_unread_mentions: action.data.total_unread_mentions,
                total_unread_urgent_mentions: action.data.total_unread_urgent_mentions,
            },
        };
    case ThreadTypes.DECREMENT_THREAD_COUNTS:
        return handleDecrementThreadCounts(state, action);
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    }
    return state;
}

export function countsReducer(state: ThreadsState['counts'] = {}, action: AnyAction, extra: ExtraData) {
    switch (action.type) {
    case ThreadTypes.ALL_TEAM_THREADS_READ:
        return handleAllTeamThreadsRead(state, action);
    case ThreadTypes.READ_CHANGED_THREAD:
        if (isDmGmChannel(action.data.channelType)) {
            return state;
        }
        return handleReadChangedThread(state, action, action.data.teamId, action.data.isUrgent);
    case TeamTypes.LEAVE_TEAM:
        return handleLeaveTeam(state, action);
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.LEAVE_CHANNEL:
        return handleLeaveChannel(state, action, extra);
    case TeamTypes.RECEIVED_MY_TEAM_UNREADS: {
        const members = action.data;
        return {
            ...state,
            ...members.reduce((result: ThreadsState['counts'], member: TeamUnread) => {
                result[member.team_id] = {
                    ...state[member.team_id],
                    total_unread_threads: member.thread_count || 0,
                    total_unread_mentions: member.thread_mention_count || 0,
                    total_unread_urgent_mentions: member.thread_urgent_mention_count || 0,
                };

                return result;
            }, {}),
        };
    }
    case ThreadTypes.DECREMENT_THREAD_COUNTS: {
        if (isDmGmChannel(action.channelType)) {
            return state;
        }
        return handleDecrementThreadCounts(state, action);
    }
    }
    return state;
}
