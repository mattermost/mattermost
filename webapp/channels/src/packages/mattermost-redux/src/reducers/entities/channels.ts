// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isEqual from 'lodash/isEqual';
import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {
    Channel,
    ChannelJoinRequest,
    ChannelJoinRequestsState,
    ChannelMembership,
    ChannelStats,
    ChannelMemberCountByGroup,
    ChannelMemberCountsByGroup,
    ServerChannel,
    ChannelsState,
} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';
import type {
    RelationOneToManyUnique,
    RelationOneToOne,
    IDMappedObjects,
} from '@mattermost/types/utilities';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {AdminTypes, ChannelTypes, UserTypes, SchemeTypes, GroupTypes, PostTypes} from 'mattermost-redux/action_types';
import {General} from 'mattermost-redux/constants';
import {MarkUnread} from 'mattermost-redux/constants/channels';
import {channelListToMap, splitRoles} from 'mattermost-redux/utils/channel_utils';

import messageCounts from './channels/message_counts';

function removeMemberFromChannels(state: RelationOneToOne<Channel, Record<string, ChannelMembership>>, action: AnyAction) {
    const nextState = {...state};
    Object.keys(state).forEach((channel) => {
        nextState[channel] = {...nextState[channel]};
        delete nextState[channel][action.data.user_id];
    });
    return nextState;
}

function channelListToSet(state: RelationOneToManyUnique<Team, Channel>, action: AnyAction) {
    const nextState = {...state};

    action.data.forEach((channel: Channel) => {
        const nextSet = new Set(nextState[channel.team_id]);
        nextSet.add(channel.id);
        nextState[channel.team_id] = nextSet;
    });

    return nextState;
}

function removeChannelFromSet(state: RelationOneToManyUnique<Team, Channel>, action: AnyAction): RelationOneToManyUnique<Team, Channel> {
    const id = action.data.team_id;
    const nextSet = new Set(state[id]);
    nextSet.delete(action.data.id);
    return {
        ...state,
        [id]: nextSet,
    };
}

function currentChannelId(state = '', action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.SELECT_CHANNEL:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

function channels(state: IDMappedObjects<Channel> = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_CHANNEL: {
        const channel: Channel = toClientChannel(action.data);

        if (state[channel.id] && channel.type === General.DM_CHANNEL) {
            channel.display_name = channel.display_name || state[channel.id].display_name;
        }

        return {
            ...state,
            [channel.id]: channel,
        };
    }
    case AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS: {
        const channels: Channel[] = action.data.channels.map(toClientChannel);

        if (channels.length === 0) {
            return state;
        }

        return {
            ...state,
            ...channelListToMap(channels),
        };
    }
    case AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SEARCH:
    case ChannelTypes.RECEIVED_CHANNELS:
    case ChannelTypes.RECEIVED_ALL_CHANNELS:
    case SchemeTypes.RECEIVED_SCHEME_CHANNELS: {
        const channels: Channel[] = action.data.map(toClientChannel);

        if (channels.length === 0) {
            return state;
        }

        const nextState = {...state};

        for (let channel of channels) {
            if (state[channel.id] && channel.type === General.DM_CHANNEL && !channel.display_name) {
                channel = {...channel, display_name: state[channel.id].display_name};
            }
            nextState[channel.id] = channel;
        }

        return nextState;
    }
    case ChannelTypes.RECEIVED_CHANNEL_DELETED: {
        const {id, deleteAt} = action.data;

        if (!state[id]) {
            return state;
        }

        return {
            ...state,
            [id]: {
                ...state[id],
                delete_at: deleteAt,
            },
        };
    }
    case ChannelTypes.RECEIVED_CHANNEL_UNARCHIVED: {
        const {id} = action.data;

        if (!state[id]) {
            return state;
        }

        return {
            ...state,
            [id]: {
                ...state[id],
                delete_at: 0,
            },
        };
    }
    case ChannelTypes.LEAVE_CHANNEL: {
        if (action.data) {
            const nextState = {...state};
            Reflect.deleteProperty(nextState, action.data.id);
            return nextState;
        }
        return state;
    }

    case PostTypes.RECEIVED_NEW_POST: {
        const {channel_id: channelId, create_at: createAt, root_id: rootId} = action.data;
        const isCrtReply = action.features?.crtEnabled && rootId !== '';

        const channel = state[channelId];

        if (!channel) {
            return state;
        }

        const lastRootPostAt = isCrtReply ? channel.last_root_post_at : Math.max(createAt, channel.last_root_post_at);

        return {
            ...state,
            [channelId]: {
                ...channel,
                last_post_at: Math.max(createAt, channel.last_post_at),
                last_root_post_at: lastRootPostAt,
            },
        };
    }

    case ChannelTypes.UPDATED_CHANNEL_SCHEME: {
        const {channelId, schemeId} = action.data;
        const channel = state[channelId];

        if (!channel) {
            return state;
        }

        return {...state, [channelId]: {...channel, scheme_id: schemeId}};
    }

    case AdminTypes.REMOVE_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SUCCESS: {
        const {channels} = action.data;
        const nextState = {...state};
        channels.forEach((channelId: string) => {
            if (nextState[channelId]) {
                nextState[channelId] = {
                    ...nextState[channelId],
                    policy_id: null,
                };
            }
        });

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function toClientChannel(serverChannel: ServerChannel): Channel {
    const channel = {...serverChannel};

    Reflect.deleteProperty(channel, 'total_msg_count');
    Reflect.deleteProperty(channel, 'total_msg_count_root');

    return channel;
}

function channelsInTeam(state: ChannelsState['channelsInTeam'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_CHANNEL: {
        const nextSet = new Set(state[action.data.team_id]);
        nextSet.add(action.data.id);
        return {
            ...state,
            [action.data.team_id]: nextSet,
        };
    }
    case ChannelTypes.RECEIVED_CHANNELS: {
        return channelListToSet(state, action);
    }
    case ChannelTypes.LEAVE_CHANNEL: {
        if (action.data) {
            return removeChannelFromSet(state, action);
        }
        return state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function myMembers(state: RelationOneToOne<Channel, ChannelMembership> = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER: {
        const channelMember: ChannelMembership = action.data;

        return receiveChannelMember(state, channelMember);
    }
    case ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS: {
        const nextState = {...state};
        const remove = action.remove as string[];
        if (remove) {
            remove.forEach((id: string) => {
                Reflect.deleteProperty(nextState, id);
            });
        }

        const channelMembers: ChannelMembership[] = action.data;

        return channelMembers.reduce(receiveChannelMember, state);
    }
    case ChannelTypes.RECEIVED_CHANNEL_PROPS: {
        const member = {...state[action.data.channel_id]};
        member.notify_props = action.data.notifyProps;

        return {
            ...state,
            [action.data.channel_id]: member,
        };
    }
    case ChannelTypes.SET_CHANNEL_MUTED: {
        const {channelId, muted} = action.data;

        if (!state[channelId]) {
            return state;
        }

        return {
            ...state,
            [channelId]: {
                ...state[channelId],
                notify_props: {
                    ...state[channelId].notify_props,
                    mark_unread: muted ? MarkUnread.MENTION : MarkUnread.ALL,
                },
            },
        };
    }
    case ChannelTypes.INCREMENT_UNREAD_MSG_COUNT: {
        const {
            channelId,
            amount,
            amountRoot,
            onlyMentions,
            fetchedChannelMember,
        } = action.data;
        const member = state[channelId];

        if (amount === 0 && amountRoot === 0) {
            return state;
        }

        if (!member) {
            // Don't keep track of unread posts until we've loaded the actual channel member
            return state;
        }

        if (!onlyMentions) {
            // Incrementing the msg_count marks the channel as read, so don't do that if these posts should be unread
            return state;
        }

        if (fetchedChannelMember) {
            // We've already updated the channel member with the correct msg_count
            return state;
        }

        return {
            ...state,
            [channelId]: {
                ...member,
                msg_count: member.msg_count + amount,
                msg_count_root: member.msg_count_root + amountRoot,
            },
        };
    }
    case ChannelTypes.DECREMENT_UNREAD_MSG_COUNT: {
        const {channelId, amount, amountRoot} = action.data;

        if (amount === 0 && amountRoot === 0) {
            return state;
        }

        const member = state[channelId];

        if (!member) {
            // Don't keep track of unread posts until we've loaded the actual channel member
            return state;
        }

        return {
            ...state,
            [channelId]: {
                ...member,
                msg_count: member.msg_count + amount,
                msg_count_root: member.msg_count_root + amountRoot,
            },
        };
    }
    case ChannelTypes.INCREMENT_UNREAD_MENTION_COUNT: {
        const {
            channelId,
            amount,
            amountRoot,
            amountUrgent,
            fetchedChannelMember,
        } = action.data;

        if (amount === 0 && amountRoot === 0) {
            return state;
        }

        const member = state[channelId];

        if (!member) {
            // Don't keep track of unread posts until we've loaded the actual channel member
            return state;
        }

        if (fetchedChannelMember) {
            // We've already updated the channel member with the correct msg_count
            return state;
        }

        return {
            ...state,
            [channelId]: {
                ...member,
                mention_count: member.mention_count + amount,
                mention_count_root: member.mention_count_root + amountRoot,
                urgent_mention_count: member.urgent_mention_count + amountUrgent,

            },
        };
    }
    case ChannelTypes.DECREMENT_UNREAD_MENTION_COUNT: {
        const {channelId, amount, amountRoot, amountUrgent} = action.data;

        if (amount === 0 && amountRoot === 0) {
            return state;
        }

        const member = state[channelId];

        if (!member) {
            // Don't keep track of unread posts until we've loaded the actual channel member
            return state;
        }

        return {
            ...state,
            [channelId]: {
                ...member,
                mention_count: Math.max(member.mention_count - amount, 0),
                mention_count_root: Math.max(member.mention_count_root - amountRoot, 0),
                urgent_mention_count: Math.max(member.urgent_mention_count - amountUrgent, 0),
            },
        };
    }
    case ChannelTypes.RECEIVED_LAST_VIEWED_AT: {
        const {data} = action;
        let member = state[data.channel_id];

        if (member.last_viewed_at === data.last_viewed_at) {
            return state;
        }

        member = {
            ...member,
            last_viewed_at: data.last_viewed_at,
        };

        return {
            ...state,
            [action.data.channel_id]: member,
        };
    }
    case ChannelTypes.LEAVE_CHANNEL: {
        const nextState = {...state};
        if (action.data) {
            Reflect.deleteProperty(nextState, action.data.id);
            return nextState;
        }

        return state;
    }
    case ChannelTypes.UPDATED_CHANNEL_MEMBER_SCHEME_ROLES: {
        return updateChannelMemberSchemeRoles(state, action);
    }
    case ChannelTypes.POST_UNREAD_SUCCESS: {
        const data = action.data;
        const channelState = state[data.channelId];

        if (!channelState) {
            return state;
        }

        return {
            ...state,
            [data.channelId]: {
                ...channelState,
                msg_count: data.msgCount,
                mention_count: data.mentionCount,
                msg_count_root: data.msgCountRoot,
                mention_count_root: data.mentionCountRoot,
                urgent_mention_count: data.urgentMentionCount,
                last_viewed_at: data.lastViewedAt,
            },
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function receiveChannelMember(state: RelationOneToOne<Channel, ChannelMembership>, received: ChannelMembership) {
    const existingChannelMember = state[received.channel_id];
    let updatedChannelMember = {...received};

    if (isEqual(existingChannelMember, updatedChannelMember)) {
        return state;
    }

    // https://github.com/mattermost/mattermost-webapp/pull/10589 and
    // https://github.com/mattermost/mattermost-webapp/pull/11094
    if (existingChannelMember &&
        updatedChannelMember.last_viewed_at < existingChannelMember.last_viewed_at &&
        updatedChannelMember.last_update_at <= existingChannelMember.last_update_at) {
        // The last_viewed_at should almost never decrease upon receiving a member, so if it does, assume that the
        // unread state of the existing channel member is correct. See MM-44900 for more information.
        updatedChannelMember = {
            ...received,
            last_viewed_at: Math.max(existingChannelMember.last_viewed_at, received.last_viewed_at),
            last_update_at: Math.max(existingChannelMember.last_update_at, received.last_update_at),
            msg_count: Math.max(existingChannelMember.msg_count, received.msg_count),
            msg_count_root: Math.max(existingChannelMember.msg_count_root, received.msg_count_root),
            mention_count: Math.min(existingChannelMember.mention_count, received.mention_count),
            urgent_mention_count: Math.min(existingChannelMember.urgent_mention_count, received.urgent_mention_count),
            mention_count_root: Math.min(existingChannelMember.mention_count_root, received.mention_count_root),
        };
    }

    return {
        ...state,
        [updatedChannelMember.channel_id]: updatedChannelMember,
    };
}

function membersInChannel(state: RelationOneToOne<Channel, Record<string, ChannelMembership>> = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER:
    case ChannelTypes.RECEIVED_CHANNEL_MEMBER: {
        const member = action.data;
        const members = {...(state[member.channel_id] || {})};
        if ((!members[member.user_id]) ||
            (member.last_update_at > members[member.user_id]?.last_update_at) ||
            (member.roles !== members[member.user_id]?.roles)) {
            members[member.user_id] = member;
            return {
                ...state,
                [member.channel_id]: members,
            };
        }
        return {
            ...state,
        };
    }
    case ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS:
    case ChannelTypes.RECEIVED_CHANNEL_MEMBERS: {
        const nextState = {...state};
        const remove = action.remove as string[];
        const currentUserId = action.currentUserId;
        if (remove && currentUserId) {
            remove.forEach((id) => {
                if (nextState[id]) {
                    Reflect.deleteProperty(nextState[id], currentUserId);
                }
            });
        }

        for (const cm of action.data) {
            if (nextState[cm.channel_id]) {
                nextState[cm.channel_id] = {...nextState[cm.channel_id]};
            } else {
                nextState[cm.channel_id] = {};
            }
            nextState[cm.channel_id][cm.user_id] = cm;
        }
        return nextState;
    }

    case UserTypes.PROFILE_NO_LONGER_VISIBLE:
        return removeMemberFromChannels(state, action);

    case ChannelTypes.LEAVE_CHANNEL:
    case ChannelTypes.REMOVE_MEMBER_FROM_CHANNEL:
    case UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL: {
        if (action.data) {
            const data = action.data;
            const members = {...(state[data.id] || {})};
            if (state[data.id]) {
                Reflect.deleteProperty(members, data.user_id);
                return {
                    ...state,
                    [data.id]: members,
                };
            }
        }

        return state;
    }
    case ChannelTypes.UPDATED_CHANNEL_MEMBER_SCHEME_ROLES: {
        return updateChannelMemberSchemeRoles(state, action);
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function stats(state: RelationOneToOne<Channel, ChannelStats> = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_CHANNEL_STATS: {
        const stat: ChannelStats = action.data;

        if (isEqual(state[stat.channel_id], stat)) {
            return state;
        }

        return {
            ...state,
            [stat.channel_id]: stat,
        };
    }
    case ChannelTypes.ADD_CHANNEL_MEMBER_SUCCESS: {
        const nextState = {...state};
        const id = action.id;
        const receivedCount = action.count ? action.count : 1;
        const nextStat = nextState[id];
        if (nextStat) {
            const count = nextStat.member_count + receivedCount;
            return {
                ...nextState,
                [id]: {
                    ...nextStat,
                    member_count: count,
                },
            };
        }

        return state;
    }
    case ChannelTypes.REMOVE_CHANNEL_MEMBER_SUCCESS: {
        const nextState = {...state};
        const id = action.id;
        const nextStat = nextState[id];
        if (nextStat) {
            const count = nextStat.member_count - 1;
            return {
                ...nextState,
                [id]: {
                    ...nextStat,
                    member_count: count || 1,
                },
            };
        }

        return state;
    }
    case ChannelTypes.INCREMENT_PINNED_POST_COUNT: {
        const nextState = {...state};
        const id = action.id;
        const nextStat = nextState[id];
        if (nextStat) {
            const count = nextStat.pinnedpost_count + 1;
            return {
                ...nextState,
                [id]: {
                    ...nextStat,
                    pinnedpost_count: count,
                },
            };
        }

        return state;
    }
    case ChannelTypes.DECREMENT_PINNED_POST_COUNT: {
        const nextState = {...state};
        const id = action.id;
        const nextStat = nextState[id];
        if (nextStat) {
            const count = nextStat.pinnedpost_count - 1;
            return {
                ...nextState,
                [id]: {
                    ...nextStat,
                    pinnedpost_count: count,
                },
            };
        }

        return state;
    }
    case ChannelTypes.INCREMENT_FILE_COUNT: {
        const nextState = {...state};
        const id = action.id;
        const nextStat = nextState[id];
        if (nextStat) {
            const count = nextStat.files_count + action.amount;
            return {
                ...nextState,
                [id]: {
                    ...nextStat,
                    files_count: count,
                },
            };
        }

        return state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function channelsMemberCount(state: Record<string, number> = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_CHANNELS_MEMBER_COUNT: {
        const memberCount = action.data;
        return {
            ...state,
            ...memberCount,
        };
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function groupsAssociatedToChannel(state: any = {}, action: MMReduxAction) {
    switch (action.type) {
    case GroupTypes.RECEIVED_ALL_GROUPS_ASSOCIATED_TO_CHANNELS_IN_TEAM: {
        const {groupsByChannelId} = action.data;
        const nextState = {...state};

        for (const channelID of Object.keys(groupsByChannelId)) {
            if (groupsByChannelId[channelID]) {
                const associatedGroupIDs = new Set<string>([]);
                for (const group of groupsByChannelId[channelID]) {
                    associatedGroupIDs.add(group.id);
                }
                const ids = Array.from(associatedGroupIDs);
                nextState[channelID] = {ids, totalCount: ids.length};
            }
        }

        return nextState;
    }
    case GroupTypes.RECEIVED_GROUP_ASSOCIATED_TO_CHANNEL: {
        const {channelID, groups} = action.data;
        const nextState = {...state};
        const associatedGroupIDs = new Set(state[channelID] ? state[channelID].ids : []);
        for (const group of groups) {
            associatedGroupIDs.add(group.id);
        }
        nextState[channelID] = {ids: Array.from(associatedGroupIDs), totalCount: associatedGroupIDs.size};

        return nextState;
    }
    case GroupTypes.RECEIVED_GROUPS_ASSOCIATED_TO_CHANNEL: {
        const {channelID, groups, totalGroupCount} = action.data;
        const nextState = {...state};
        const associatedGroupIDs = new Set<string>([]);
        for (const group of groups) {
            associatedGroupIDs.add(group.id);
        }
        nextState[channelID] = {ids: Array.from(associatedGroupIDs), totalCount: totalGroupCount};

        return nextState;
    }
    case GroupTypes.RECEIVED_ALL_GROUPS_ASSOCIATED_TO_CHANNEL: {
        const {channelID, groups} = action.data;
        const nextState = {...state};
        const associatedGroupIDs = new Set<string>([]);
        for (const group of groups) {
            associatedGroupIDs.add(group.id);
        }
        const ids = Array.from(associatedGroupIDs);
        nextState[channelID] = {ids, totalCount: ids.length};

        return nextState;
    }
    case GroupTypes.RECEIVED_GROUP_NOT_ASSOCIATED_TO_CHANNEL:
    case GroupTypes.RECEIVED_GROUPS_NOT_ASSOCIATED_TO_CHANNEL: {
        const {channelID, groups} = action.data;

        const nextState = {...state};
        const associatedGroupIDs = new Set(state[channelID] ? state[channelID].ids : []);

        for (const group of groups) {
            associatedGroupIDs.delete(group.id);
        }
        nextState[channelID] = {ids: Array.from(associatedGroupIDs), totalCount: associatedGroupIDs.size};

        return nextState;
    }
    default:
        return state;
    }
}

function updateChannelMemberSchemeRoles(state: any, action: AnyAction) {
    const {channelId, userId, isSchemeUser, isSchemeAdmin} = action.data;
    const channel = state[channelId];
    if (channel) {
        const member = channel[userId];
        if (member) {
            return {
                ...state,
                [channelId]: {
                    ...state[channelId],
                    [userId]: {
                        ...state[channelId][userId],
                        scheme_user: isSchemeUser,
                        scheme_admin: isSchemeAdmin,
                    },
                },
            };
        }
    }
    return state;
}

function totalCount(state = 0, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_TOTAL_CHANNEL_COUNT: {
        return action.data;
    }
    default:
        return state;
    }
}

export function manuallyUnread(state: RelationOneToOne<Channel, boolean> = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.REMOVE_MANUALLY_UNREAD: {
        if (state[action.data.channelId]) {
            const newState = {...state};
            delete newState[action.data.channelId];
            return newState;
        }
        return state;
    }
    case UserTypes.LOGOUT_SUCCESS: {
        // user is logging out, remove any reference
        return {};
    }

    case ChannelTypes.ADD_MANUALLY_UNREAD:
    case ChannelTypes.POST_UNREAD_SUCCESS: {
        return {...state, [action.data.channelId]: true};
    }
    default:
        return state;
    }
}

export function channelModerations(state: any = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_CHANNEL_MODERATIONS: {
        const {channelId, moderations} = action.data;
        return {
            ...state,
            [channelId]: moderations,
        };
    }
    default:
        return state;
    }
}

export function channelMemberCountsByGroup(state: any = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_CHANNEL_MEMBER_COUNTS_BY_GROUP: {
        const {channelId, memberCounts} = action.data;
        const memberCountsByGroup: ChannelMemberCountsByGroup = {};
        memberCounts.forEach((channelMemberCount: ChannelMemberCountByGroup) => {
            memberCountsByGroup[channelMemberCount.group_id] = channelMemberCount;
        });

        return {
            ...state,
            [channelId]: memberCountsByGroup,
        };
    }
    case ChannelTypes.RECEIVED_CHANNEL_MEMBER_COUNTS_FROM_GROUPS_LIST: {
        const memberCountsByGroup: ChannelMemberCountsByGroup = {};
        action.data.forEach((group: Group) => {
            memberCountsByGroup[group.id] = {
                group_id: group.id,
                channel_member_count: group.member_count || 0,
                channel_member_timezones_count: group.channel_member_timezones_count || 0,
            };
        });

        return {
            ...state,
            [action.channelId]: memberCountsByGroup,
        };
    }
    default:
        return state;
    }
}

function roles(state: RelationOneToOne<Channel, Set<string>> = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER: {
        const channelMember = action.data;
        const oldRoles = state[channelMember.channel_id];
        const newRoles = splitRoles(channelMember.roles);

        // If roles didn't change no need to update state
        if (isEqual(oldRoles, newRoles)) {
            return state;
        }

        return {
            ...state,
            [channelMember.channel_id]: newRoles,
        };
    }
    case ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS: {
        const nextState = {...state};
        const remove = action.remove as string[];
        let stateChanged = false;
        if (remove && remove.length) {
            remove.forEach((id: string) => {
                Reflect.deleteProperty(nextState, id);
            });
            stateChanged = true;
        }

        for (const cm of action.data) {
            const oldRoles = nextState[cm.channel_id];
            const newRoles = splitRoles(cm.roles);

            // If roles didn't change no need to update state
            if (!isEqual(oldRoles, newRoles)) {
                nextState[cm.channel_id] = splitRoles(cm.roles);
                stateChanged = true;
            }
        }

        if (stateChanged) {
            return nextState;
        }

        return state;
    }
    case ChannelTypes.LEAVE_CHANNEL: {
        const nextState = {...state};
        if (action.data) {
            Reflect.deleteProperty(nextState, action.data.id);
            return nextState;
        }

        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function restrictedDMs(state: ChannelsState['restrictedDMs'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTypes.RECEIVED_IS_DM_RESTRICTED: {
        return {
            ...state,
            [action.data.channelId]: action.data.isRestricted,
        };
    }
    case ChannelTypes.RESTRICTED_DMS_TEAMS_CHANGED:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

// Discoverable Private Channels — join requests reducer.
//
// One slice tracks four orthogonal projections of the same underlying rows:
// - myPendingByChannel: the user's own pending row per channel (drives Browse
//   row state machine + Request to Join modal pending state).
// - byChannel: full admin-queue listings keyed by channel id (drives the
//   admin queue UI in PR 4).
// - countsByChannel: lightweight pending count per channel (drives the
//   indicator triad).
// - myList: the user's pending requests across channels (drives the My
//   Pending Requests tab in PR 4).
//
// WebSocket events (channel_join_request_created / _updated) and the local
// action thunks both feed this slice. Terminal status transitions
// (approved / denied / withdrawn) clear the myPending entry but keep the row
// in byChannel so the admin's Past tab can show it.
const initialJoinRequestsState: ChannelJoinRequestsState = {
    myPendingByChannel: {},
    byChannel: {},
    countsByChannel: {},
    myList: [],
};

function isTerminal(status: ChannelJoinRequest['status']) {
    return status === 'approved' || status === 'denied' || status === 'withdrawn';
}

export function joinRequests(state: ChannelJoinRequestsState = initialJoinRequestsState, action: MMReduxAction): ChannelJoinRequestsState {
    switch (action.type) {
    case ChannelTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST: {
        const req: ChannelJoinRequest = action.data;
        if (isTerminal(req.status)) {
            const rest = {...state.myPendingByChannel};
            Reflect.deleteProperty(rest, req.channel_id);
            return {...state, myPendingByChannel: rest};
        }
        return {
            ...state,
            myPendingByChannel: {...state.myPendingByChannel, [req.channel_id]: req},
        };
    }

    case ChannelTypes.RECEIVED_MY_CHANNEL_JOIN_REQUESTS: {
        const rows: ChannelJoinRequest[] = action.data.requests ?? [];
        const myPending: Record<string, ChannelJoinRequest> = {};
        rows.forEach((req) => {
            if (req.status === 'pending') {
                myPending[req.channel_id] = req;
            }
        });

        // This is the authoritative full list of the user's requests, so
        // rebuild myPendingByChannel from it rather than merging — a request
        // that resolved while the client missed the WebSocket event would
        // otherwise linger as a stale pending entry.
        return {
            ...state,
            myList: rows,
            myPendingByChannel: myPending,
        };
    }

    case ChannelTypes.RECEIVED_CHANNEL_JOIN_REQUESTS: {
        const {channel_id: channelId, list} = action.data;
        return {
            ...state,
            byChannel: {...state.byChannel, [channelId]: list.requests ?? []},
        };
    }

    case ChannelTypes.RECEIVED_CHANNEL_JOIN_REQUEST_COUNT: {
        const {channel_id: channelId, count} = action.data;
        return {
            ...state,
            countsByChannel: {...state.countsByChannel, [channelId]: count},
        };
    }

    case ChannelTypes.CHANNEL_JOIN_REQUEST_CREATED: {
        const req: ChannelJoinRequest = action.data;
        const existing = state.byChannel[req.channel_id] ?? [];
        const alreadyTracked = existing.some((r) => r.id === req.id);
        const dedup = existing.filter((r) => r.id !== req.id);

        // Only bump the pending count for a genuinely new pending row. A
        // re-delivered CREATED event (same id) must not inflate the count.
        const counts = (alreadyTracked || req.status !== 'pending') ? state.countsByChannel : {
            ...state.countsByChannel,
            [req.channel_id]: (state.countsByChannel[req.channel_id] ?? 0) + 1,
        };
        return {
            ...state,
            byChannel: {...state.byChannel, [req.channel_id]: [req, ...dedup]},
            countsByChannel: counts,
        };
    }

    case ChannelTypes.CHANNEL_JOIN_REQUEST_UPDATED: {
        const req: ChannelJoinRequest = action.data;
        const existing = state.byChannel[req.channel_id] ?? [];
        const prev = existing.find((r) => r.id === req.id);

        // Persist the row even when it wasn't tracked yet, so a re-delivered
        // terminal event finds it and becomes a terminal -> terminal no-op
        // rather than decrementing the count a second time.
        const replaced = prev ?
            existing.map((r) => (r.id === req.id ? req : r)) :
            [req, ...existing];
        const myPending = {...state.myPendingByChannel};
        if (isTerminal(req.status)) {
            delete myPending[req.channel_id];
        }
        const myList = state.myList.map((r) => (r.id === req.id ? req : r));

        // Adjust the pending count from the actual status transition rather
        // than the incoming status alone. This keeps the count correct when
        // the acting admin receives BOTH the optimistic local dispatch and
        // the server's WebSocket echo for a single approve/deny: the first
        // dispatch flips the tracked row to terminal, so the echo becomes a
        // terminal -> terminal no-op. When the row isn't tracked (only the
        // count is loaded, not the full queue) there is no local echo to
        // double-count, so fall back to a single decrement on a terminal
        // update. The floor at 0 guards against any missed CREATED bump.
        let counts = state.countsByChannel;
        const leftPending = isTerminal(req.status) && (prev ? prev.status === 'pending' : true);
        if (leftPending) {
            const next = (counts[req.channel_id] ?? 0) - 1;
            counts = {...counts, [req.channel_id]: Math.max(0, next)};
        }
        return {
            ...state,
            byChannel: {...state.byChannel, [req.channel_id]: replaced},
            myPendingByChannel: myPending,
            myList,
            countsByChannel: counts,
        };
    }

    case ChannelTypes.CHANNEL_JOIN_REQUEST_REMOVED: {
        const {channel_id: channelId, request_id: requestId} = action.data;
        const rest = {...state.myPendingByChannel};
        Reflect.deleteProperty(rest, channelId);
        const filtered = requestId ? (state.byChannel[channelId] ?? []).filter((r) => r.id !== requestId) : state.byChannel[channelId];
        const myList = requestId ? state.myList.filter((r) => r.id !== requestId) : state.myList;
        return {
            ...state,
            myPendingByChannel: rest,
            byChannel: filtered ? {...state.byChannel, [channelId]: filtered} : state.byChannel,
            myList,
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return initialJoinRequestsState;

    default:
        return state;
    }
}

export default combineReducers({

    // the current selected channel
    currentChannelId,

    // object where every key is the channel id and has and object with the channel detail
    channels,

    // object where every key is a team id and has set of channel ids that are on the team
    channelsInTeam,

    // object where every key is the channel id and has an object with the channel members detail
    myMembers,

    // object where every key is the channel id and has an object with the channel roles
    roles,

    // object where every key is the channel id with an object where key is a user id and has an object with the channel members detail
    membersInChannel,

    // object where every key is the channel id and has an object with the channel stats
    stats,

    groupsAssociatedToChannel,

    totalCount,

    // object where every key is the channel id, if present means a user requested to mark that channel as unread.
    manuallyUnread,

    // object where every key is the channel id and has an object with the channel moderations
    channelModerations,

    // object where every key is the channel id containing map of <group_id: ChannelMemberCountByGroup>
    channelMemberCountsByGroup,

    // object where every key is the channel id mapping to an object containing the number of messages in the channel
    messageCounts,

    // object where key is the channel id and value is the member count for the channel
    channelsMemberCount,

    restrictedDMs,

    // Discoverable Private Channels — join requests slice
    joinRequests,
});
