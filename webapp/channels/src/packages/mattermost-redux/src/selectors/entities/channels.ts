// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import max from 'lodash/max';

import type {
    Channel,
    ChannelBanner,
    ChannelMemberCountsByGroup,
    ChannelMembership,
    ChannelMessageCount,
    ChannelModeration,
    ChannelSearchOpts,
    ChannelStats,
} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile, UsersState} from '@mattermost/types/users';
import type {
    IDMappedObjects,
    RelationOneToManyUnique,
    RelationOneToOne,
} from '@mattermost/types/utilities';

import {General, Permissions, Preferences} from 'mattermost-redux/constants';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getDataRetentionCustomPolicy} from 'mattermost-redux/selectors/entities/admin';
import {getCategoryInTeamByType} from 'mattermost-redux/selectors/entities/channel_categories';
import {
    getCurrentChannelId as getCurrentChannelIdInternal,
    getCurrentUser,
    getMyChannelMemberships as getMyChannelMembershipsInternal,
    getMyCurrentChannelMembership as getMyCurrentChannelMembershipInternal,
    getUsers,
} from 'mattermost-redux/selectors/entities/common';
import {
    getTeammateNameDisplaySetting,
    isCollapsedThreadsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';
import {
    haveIChannelPermission,
    haveICurrentChannelPermission,
    haveITeamPermission,
} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {
    getCurrentUserId,
    getStatusForUserId,
    getUser,
    getUserIdsInChannels,
    isCurrentUserSystemAdmin,
} from 'mattermost-redux/selectors/entities/users';
import {
    calculateUnreadCount,
    completeDirectChannelDisplayName,
    completeDirectChannelInfo,
    completeDirectGroupInfo,
    filterChannelsMatchingTerm,
    getChannelByName as getChannelByNameHelper,
    getUserIdFromChannelName,
    isChannelMuted,
    isDefault,
    isDirectChannel,
    newCompleteDirectChannelInfo,
    sortChannelsByDisplayName,
} from 'mattermost-redux/utils/channel_utils';
import {createIdsSelector} from 'mattermost-redux/utils/helpers';

import {isPostPriorityEnabled} from './posts';
import {getThreadCounts, getThreadCountsIncludingDirect} from './threads';

// Re-define these types to ensure that these are typed correctly when mattermost-redux is published
export const getCurrentChannelId: (state: GlobalState) => string = getCurrentChannelIdInternal;
export const getMyChannelMemberships: (state: GlobalState) => RelationOneToOne<Channel, ChannelMembership> = getMyChannelMembershipsInternal;
export const getMyCurrentChannelMembership: (state: GlobalState) => ChannelMembership | undefined = getMyCurrentChannelMembershipInternal;

export function getAllChannels(state: GlobalState): IDMappedObjects<Channel> {
    return state.entities.channels.channels;
}

export const getAllDmChannels = createSelector(
    'getAllDmChannels',
    getAllChannels,
    (allChannels) => {
        let allDmChannels: Record<string, Channel> = {};

        Object.values(allChannels).forEach((channel: Channel) => {
            if (channel.type === General.DM_CHANNEL) {
                allDmChannels = {...allDmChannels, [channel.name]: channel};
            }
        });

        return allDmChannels;
    },
);

export function getAllChannelStats(state: GlobalState): RelationOneToOne<Channel, ChannelStats> {
    return state.entities.channels.stats;
}

export function getChannelsMemberCount(state: GlobalState): Record<string, number> {
    return state.entities.channels.channelsMemberCount;
}

export function getChannelsInTeam(state: GlobalState): RelationOneToManyUnique<Team, Channel> {
    return state.entities.channels.channelsInTeam;
}

export function getChannelsInPolicy() {
    return (createSelector(
        'getChannelsInPolicy',
        getAllChannels,
        (state: GlobalState, props: {policyId: string}) => getDataRetentionCustomPolicy(state, props.policyId),
        (getAllChannels, policy) => {
            if (!policy) {
                return [];
            }

            const policyChannels: Channel[] = [];

            Object.entries(getAllChannels).forEach((channelEntry: [string, Channel]) => {
                const [, channel] = channelEntry;
                if (channel.policy_id === policy.id) {
                    policyChannels.push(channel);
                }
            });

            return policyChannels;
        }) as (b: GlobalState, a: {
        policyId: string;
    }) => Channel[]);
}

export const getDirectChannelsSet: (state: GlobalState) => Set<string> = createSelector(
    'getDirectChannelsSet',
    getChannelsInTeam,
    (channelsInTeam: RelationOneToManyUnique<Team, Channel>): Set<string> => {
        if (!channelsInTeam) {
            return new Set();
        }

        return new Set(channelsInTeam['']);
    },
);

export function getChannelMembersInChannels(state: GlobalState): RelationOneToOne<Channel, Record<string, ChannelMembership>> {
    return state.entities.channels.membersInChannel;
}

export function getChannelMember(state: GlobalState, channelId: string, userId: string): ChannelMembership | undefined {
    return getChannelMembersInChannels(state)[channelId]?.[userId];
}

type OldMakeChannelArgument = {id: string};

// makeGetChannel returns a selector that returns a channel from the store with the following filled in for DM/GM channels:
// - The display_name set to the other user(s) names, following the Teammate Name Display setting
// - The teammate_id for DM channels
// - The status of the other user in a DM channel
export function makeGetChannel(): (state: GlobalState, id: string) => Channel | undefined {
    return createSelector(
        'makeGetChannel',
        getCurrentUserId,
        (state: GlobalState) => state.entities.users.profiles,
        (state: GlobalState) => state.entities.users.profilesInChannel,
        (state: GlobalState, channelId: string | OldMakeChannelArgument) => {
            const id = typeof channelId === 'string' ? channelId : channelId.id;
            const channel = getChannel(state, id);
            if (!channel || !isDirectChannel(channel)) {
                return '';
            }

            const currentUserId = getCurrentUserId(state);
            const teammateId = getUserIdFromChannelName(currentUserId, channel.name);
            const teammateStatus = getStatusForUserId(state, teammateId);

            return teammateStatus || 'offline';
        },
        (state: GlobalState, channelId: string | OldMakeChannelArgument) => {
            const id = typeof channelId === 'string' ? channelId : channelId.id;
            return getChannel(state, id);
        },
        getTeammateNameDisplaySetting,
        (currentUserId, profiles, profilesInChannel, teammateStatus, channel, teammateNameDisplay) => {
            if (channel) {
                return newCompleteDirectChannelInfo(currentUserId, profiles, profilesInChannel, teammateStatus, teammateNameDisplay!, channel);
            }

            return channel;
        },
    );
}

// getChannel returns a channel as it exists in the store without filling in any additional details such as the
// display_name for DM/GM channels.
export function getChannel(state: GlobalState, id: string): Channel | undefined {
    return getAllChannels(state)[id];
}

// getDirectChannel returns a direct channel channel as it exists in the store filling in any additional details such as the
// display_name or teammate_id.
export function getDirectChannel(state: GlobalState, id: string): Channel | undefined {
    const channel = getAllChannels(state)[id];
    if (channel && channel.type === 'D') {
        return completeDirectChannelInfo(state.entities.users, getTeammateNameDisplaySetting(state), channel);
    }
    return undefined;
}

export function getMyChannelMembership(state: GlobalState, channelId: string): ChannelMembership | undefined {
    return getMyChannelMemberships(state)[channelId];
}

// makeGetChannelsForIds returns a selector that, given an array of channel IDs, returns a list of the corresponding
// channels. Channels are returned in the same order as the given IDs with undefined entries replacing any invalid IDs.
// Note that memoization will fail if an array literal is passed in.
export function makeGetChannelsForIds(): (state: GlobalState, ids: string[]) => Channel[] {
    return createSelector(
        'makeGetChannelsForIds',
        getAllChannels,
        (state: GlobalState, ids: string[]) => ids,
        (allChannels, ids) => {
            return ids.map((id) => allChannels[id]);
        },
    );
}

export const getCurrentChannel: (state: GlobalState) => Channel | undefined = createSelector(
    'getCurrentChannel',
    getAllChannels,
    getCurrentChannelId,
    (state: GlobalState) => state.entities.users,
    getTeammateNameDisplaySetting,
    (allChannels, currentChannelId, users, teammateNameDisplay): Channel => {
        const channel = allChannels[currentChannelId];

        if (channel) {
            return completeDirectChannelInfo(users, teammateNameDisplay, channel);
        }

        return channel;
    },
);

const getChannelNameForSearch = (channel: Channel | undefined, users: UsersState): string | undefined => {
    if (!channel) {
        return undefined;
    }

    // Only get the extra info from users if we need it
    if (channel.type === General.DM_CHANNEL) {
        const dmChannelWithInfo = completeDirectChannelInfo(users, Preferences.DISPLAY_PREFER_USERNAME, channel);
        return `@${dmChannelWithInfo.display_name}`;
    }

    // Replace spaces in GM channel names
    if (channel.type === General.GM_CHANNEL) {
        const gmChannelWithInfo = completeDirectGroupInfo(users, Preferences.DISPLAY_PREFER_USERNAME, channel, false);
        return `@${gmChannelWithInfo.display_name.replace(/\s/g, '')}`;
    }

    return channel.name;
};

export const getCurrentChannelNameForSearchShortcut: (state: GlobalState) => string | undefined = createSelector(
    'getCurrentChannelNameForSearchShortcut',
    getAllChannels,
    getCurrentChannelId,
    (state: GlobalState): UsersState => state.entities.users,
    (allChannels: IDMappedObjects<Channel>, currentChannelId: string, users: UsersState): string | undefined => {
        const channel = allChannels[currentChannelId];
        return getChannelNameForSearch(channel, users);
    },
);

export const getChannelNameForSearchShortcut: (state: GlobalState, channelId: string) => string | undefined = createSelector(
    'getChannelNameForSearchShortcut',
    getAllChannels,
    (state: GlobalState): UsersState => state.entities.users,
    (state: GlobalState, channelId: string): string => channelId,
    (allChannels: IDMappedObjects<Channel>, users: UsersState, channelId: string): string | undefined => {
        const channel = allChannels[channelId];
        return getChannelNameForSearch(channel, users);
    },
);

export const getMyChannelMember: (state: GlobalState, channelId: string) => ChannelMembership | undefined = createSelector(
    'getMyChannelMember',
    getMyChannelMemberships,
    (state: GlobalState, channelId: string): string => channelId,
    (channelMemberships: RelationOneToOne<Channel, ChannelMembership>, channelId: string): ChannelMembership | undefined => {
        return channelMemberships[channelId];
    },
);

export const getCurrentChannelStats: (state: GlobalState) => ChannelStats | undefined = createSelector(
    'getCurrentChannelStats',
    getAllChannelStats,
    getCurrentChannelId,
    (allChannelStats: RelationOneToOne<Channel, ChannelStats>, currentChannelId: string): ChannelStats => {
        return allChannelStats[currentChannelId];
    },
);

export function isCurrentChannelFavorite(state: GlobalState): boolean {
    const currentChannelId = getCurrentChannelId(state);
    return isFavoriteChannel(state, currentChannelId);
}

export const isCurrentChannelMuted: (state: GlobalState) => boolean = createSelector(
    'isCurrentChannelMuted',
    getMyCurrentChannelMembership,
    (membership?: ChannelMembership): boolean => {
        if (!membership) {
            return false;
        }

        return isChannelMuted(membership);
    },
);

export const isMutedChannel: (state: GlobalState, channelId: string) => boolean = createSelector(
    'isMutedChannel',
    (state: GlobalState, channelId: string) => getMyChannelMembership(state, channelId),
    (membership?: ChannelMembership): boolean => {
        if (!membership) {
            return false;
        }

        return isChannelMuted(membership);
    },
);

export const isCurrentChannelArchived: (state: GlobalState) => boolean = createSelector(
    'isCurrentChannelArchived',
    getCurrentChannel,
    (channel) => channel?.delete_at !== 0,
);

export const isCurrentChannelDefault: (state: GlobalState) => boolean = createSelector(
    'isCurrentChannelDefault',
    getCurrentChannel,
    (channel) => isDefault(channel),
);

export function isCurrentChannelReadOnly(state: GlobalState): boolean {
    return isChannelReadOnly(state, getCurrentChannel(state));
}

export function isChannelReadOnlyById(state: GlobalState, channelId: string): boolean {
    return isChannelReadOnly(state, getChannel(state, channelId));
}

export function isChannelReadOnly(state: GlobalState, channel?: Channel): boolean {
    return Boolean(channel && channel.name === General.DEFAULT_CHANNEL && !isCurrentUserSystemAdmin(state));
}

export function getChannelMessageCounts(state: GlobalState): RelationOneToOne<Channel, ChannelMessageCount> {
    return state.entities.channels.messageCounts;
}

export function getChannelMessageCount(state: GlobalState, channelId: string): ChannelMessageCount | undefined {
    return getChannelMessageCounts(state)[channelId];
}

function getCurrentChannelMessageCount(state: GlobalState) {
    return getChannelMessageCount(state, getCurrentChannelId(state));
}

export const countCurrentChannelUnreadMessages: (state: GlobalState) => number = createSelector(
    'countCurrentChannelUnreadMessages',
    getCurrentChannelMessageCount,
    getMyCurrentChannelMembership,
    isCollapsedThreadsEnabled,
    (messageCount?: ChannelMessageCount, membership?: ChannelMembership, crtEnabled?: boolean): number => {
        if (!membership || !messageCount) {
            return 0;
        }
        return crtEnabled ? messageCount.root - membership.msg_count_root : messageCount.total - membership.msg_count;
    },
);

export function makeGetChannelUnreadCount(): (state: GlobalState, channelId: string) => ReturnType<typeof calculateUnreadCount> {
    return createSelector(
        'makeGetChannelUnreadCount',
        (state: GlobalState, channelId: string) => getChannelMessageCount(state, channelId),
        (state: GlobalState, channelId: string) => getMyChannelMembership(state, channelId),
        isCollapsedThreadsEnabled,
        (messageCount: ChannelMessageCount | undefined, member: ChannelMembership | undefined, crtEnabled) =>
            calculateUnreadCount(messageCount, member, crtEnabled),
    );
}

export function getChannelByName(state: GlobalState, channelName: string): Channel | undefined {
    return getChannelByNameHelper(getAllChannels(state), channelName);
}

export function getChannelByTeamIdAndChannelName(state: GlobalState, teamId: string, channelName: string): Channel | undefined | null {
    return Object.values(getAllChannels(state)).find((channel) =>
        channel.team_id === teamId && channel.name === channelName,
    );
}

export const getChannelSetInCurrentTeam: (state: GlobalState) => Set<string> = createSelector(
    'getChannelSetInCurrentTeam',
    getCurrentTeamId,
    getChannelsInTeam,
    (currentTeamId: string, channelsInTeam: RelationOneToManyUnique<Team, Channel>) => {
        return (channelsInTeam && channelsInTeam[currentTeamId]) || new Set();
    },
);

export const getChannelSetForAllTeams: (state: GlobalState) => string[] = createSelector(
    'getChannelSetForAllTeams',
    getAllChannels,
    (allChannels): string[] => {
        const channelSet: string[] = [];
        Object.values(allChannels).forEach((channel: Channel) => {
            if (channel.type !== General.GM_CHANNEL && channel.type !== General.DM_CHANNEL) {
                channelSet.push(channel.id);
            }
        });
        return channelSet;
    },
);

function sortAndInjectChannels(channels: IDMappedObjects<Channel>, channelSet: string[] | Set<string>, locale: string): Channel[] {
    const currentChannels: Channel[] = [];

    if (typeof channelSet === 'undefined') {
        return currentChannels;
    }

    channelSet.forEach((c) => {
        currentChannels.push(channels[c]);
    });

    return currentChannels.sort(sortChannelsByDisplayName.bind(null, locale));
}

export const getChannelsInCurrentTeam: (state: GlobalState) => Channel[] = createSelector(
    'getChannelsInCurrentTeam',
    getAllChannels,
    getChannelSetInCurrentTeam,
    getCurrentUser,
    (channels: IDMappedObjects<Channel>, currentTeamChannelSet: Set<string>, currentUser: UserProfile): Channel[] => {
        let locale = General.DEFAULT_LOCALE;

        if (currentUser && currentUser.locale) {
            locale = currentUser.locale;
        }

        return sortAndInjectChannels(channels, currentTeamChannelSet, locale);
    },
);

export const getChannelsInAllTeams: (state: GlobalState) => Channel[] = createSelector(
    'getChannelsInAllTeams',
    getAllChannels,
    getChannelSetForAllTeams,
    getCurrentUser,
    (channels: IDMappedObjects<Channel>, getChannelSetForAllTeams: string[], currentUser: UserProfile): Channel[] => {
        const locale = currentUser?.locale || General.DEFAULT_LOCALE;
        return sortAndInjectChannels(channels, getChannelSetForAllTeams, locale);
    },
);

export const getChannelsNameMapInTeam: (state: GlobalState, teamId: string) => Record<string, Channel> = createSelector(
    'getChannelsNameMapInTeam',
    getAllChannels,
    getChannelsInTeam,
    (state: GlobalState, teamId: string): string => teamId,
    (channels: IDMappedObjects<Channel>, channelsInTeams: RelationOneToManyUnique<Team, Channel>, teamId: string): Record<string, Channel> => {
        const channelsInTeam = channelsInTeams[teamId] || new Set();
        const channelMap: Record<string, Channel> = {};
        channelsInTeam.forEach((id) => {
            const channel = channels[id];
            channelMap[channel.name] = channel;
        });
        return channelMap;
    },
);

export const getChannelsNameMapInCurrentTeam: (state: GlobalState) => Record<string, Channel> = createSelector(
    'getChannelsNameMapInCurrentTeam',
    getAllChannels,
    getChannelSetInCurrentTeam,
    (channels: IDMappedObjects<Channel>, currentTeamChannelSet: Set<string>): Record<string, Channel> => {
        const channelMap: Record<string, Channel> = {};
        currentTeamChannelSet.forEach((id) => {
            const channel = channels[id];
            channelMap[channel.name] = channel;
        });
        return channelMap;
    },
);

export const getChannelNameToDisplayNameMap: (state: GlobalState) => Record<string, string> = createIdsSelector(
    'getChannelNameToDisplayNameMap',
    getAllChannels,
    getChannelSetInCurrentTeam,
    (channels: IDMappedObjects<Channel>, currentTeamChannelSet: Set<string>) => {
        const channelMap: Record<string, string> = {};
        for (const id of currentTeamChannelSet) {
            const channel = channels[id];
            channelMap[channel.name] = channel.display_name;
        }
        return channelMap;
    },
);

// Returns both DMs and GMs
export const getAllDirectChannels: (state: GlobalState) => Channel[] = createSelector(
    'getAllDirectChannels',
    getAllChannels,
    getDirectChannelsSet,
    (state: GlobalState): UsersState => state.entities.users,
    getTeammateNameDisplaySetting,
    (channels: IDMappedObjects<Channel>, channelSet: Set<string>, users: UsersState, teammateNameDisplay: string): Channel[] => {
        const dmChannels: Channel[] = [];
        channelSet.forEach((c) => {
            dmChannels.push(completeDirectChannelInfo(users, teammateNameDisplay, channels[c]));
        });
        return dmChannels;
    },
);

export const getAllDirectChannelsNameMapInCurrentTeam: (state: GlobalState) => Record<string, Channel> = createSelector(
    'getAllDirectChannelsNameMapInCurrentTeam',
    getAllChannels,
    getDirectChannelsSet,
    (state: GlobalState): UsersState => state.entities.users,
    getTeammateNameDisplaySetting,
    (channels: IDMappedObjects<Channel>, channelSet: Set<string>, users: UsersState, teammateNameDisplay: string): Record<string, Channel> => {
        const channelMap: Record<string, Channel> = {};
        channelSet.forEach((id) => {
            const channel = channels[id];
            channelMap[channel.name] = completeDirectChannelInfo(users, teammateNameDisplay, channel);
        });
        return channelMap;
    },
);

// Returns only GMs
export const getGroupChannels: (state: GlobalState) => Channel[] = createSelector(
    'getGroupChannels',
    getAllChannels,
    getDirectChannelsSet,
    (state: GlobalState): UsersState => state.entities.users,
    getTeammateNameDisplaySetting,
    (channels: IDMappedObjects<Channel>, channelSet: Set<string>, users: UsersState, teammateNameDisplay: string): Channel[] => {
        const gmChannels: Channel[] = [];
        channelSet.forEach((id) => {
            const channel = channels[id];

            if (channel.type === General.GM_CHANNEL) {
                gmChannels.push(completeDirectChannelInfo(users, teammateNameDisplay, channel));
            }
        });
        return gmChannels;
    },
);

export const getMyChannels: (state: GlobalState) => Channel[] = createSelector(
    'getMyChannels',
    getChannelsInCurrentTeam,
    getAllDirectChannels,
    getMyChannelMemberships,
    (channels: Channel[], directChannels: Channel[], myMembers: RelationOneToOne<Channel, ChannelMembership>): Channel[] => {
        return [...channels, ...directChannels].filter((c) => Object.hasOwn(myMembers, c.id));
    },
);

export const getOtherChannels: (state: GlobalState, archived?: boolean | null) => Channel[] = createSelector(
    'getOtherChannels',
    getChannelsInCurrentTeam,
    getMyChannelMemberships,
    (state: GlobalState, archived: boolean | undefined | null = true) => archived,
    (channels: Channel[], myMembers: RelationOneToOne<Channel, ChannelMembership>, archived?: boolean | null): Channel[] => {
        return channels.filter((c) => !Object.hasOwn(myMembers, c.id) && c.type === General.OPEN_CHANNEL && (archived ? true : c.delete_at === 0));
    },
);

export const getMembersInCurrentChannel: (state: GlobalState) => Record<string, ChannelMembership> = createSelector(
    'getMembersInCurrentChannel',
    getCurrentChannelId,
    getChannelMembersInChannels,
    (currentChannelId: string, members: RelationOneToOne<Channel, Record<string, ChannelMembership>>): Record<string, ChannelMembership> => {
        return members[currentChannelId];
    },
);

/**
 * A scalar encoding or primitive-value representation of
 */
export type BasicUnreadStatus = boolean | number;
export type BasicUnreadMeta = {isUnread: boolean; unreadMentionCount: number}

export function basicUnreadMeta(unreadStatus: BasicUnreadStatus): BasicUnreadMeta {
    return {
        isUnread: Boolean(unreadStatus),
        unreadMentionCount: (typeof unreadStatus === 'number' && unreadStatus) || 0,
    };
}

// muted channel will not be counted towards unreads
export const getUnreadStatus: (state: GlobalState) => BasicUnreadStatus = createSelector(
    'getUnreadStatus',
    getAllChannels,
    getMyChannelMemberships,
    getChannelMessageCounts,
    getUsers,
    getCurrentUserId,
    getCurrentTeamId,
    isCollapsedThreadsEnabled,
    getThreadCounts,
    getThreadCountsIncludingDirect,
    (
        channels,
        myMembers,
        messageCounts,
        users,
        currentUserId,
        currentTeamId,
        collapsedThreads,
        threadCounts,
        threadCountsIncludingDirect,
    ) => {
        const {
            messages: unreadMessages,
            mentions: unreadMentions,
        } = Object.entries(myMembers).reduce((counts, [channelId, membership]) => {
            const channel = channels[channelId];

            if (!channel || !membership) {
                return counts;
            }

            const channelExists = channel.type === General.DM_CHANNEL ? users[getUserIdFromChannelName(currentUserId, channel.name)]?.delete_at === 0 : channel.delete_at === 0;
            if (!channelExists) {
                return counts;
            }

            const mentions = collapsedThreads ? membership.mention_count_root : membership.mention_count;
            if (mentions && !isChannelMuted(membership)) {
                counts.mentions += mentions;
            }

            const unreadCount = calculateUnreadCount(messageCounts[channelId], myMembers[channelId], collapsedThreads);
            if (unreadCount.showUnread) {
                counts.messages += unreadCount.messages;
            }

            return counts;
        }, {
            messages: 0,
            mentions: 0,
        });

        const totalUnreadMessages = unreadMessages;
        let totalUnreadMentions = unreadMentions;
        let anyUnreadThreads = false;

        // when collapsed threads are enabled, we start with root-post counts from channels, then
        // add the same thread-reply counts from the global threads view
        if (collapsedThreads) {
            Object.keys(threadCounts).forEach((teamId) => {
                const c = threadCounts[teamId];
                if (teamId === currentTeamId) {
                    const currentTeamDirectCounts = threadCountsIncludingDirect[currentTeamId] || 0;
                    anyUnreadThreads = Boolean(currentTeamDirectCounts.total_unread_threads);
                    totalUnreadMentions += currentTeamDirectCounts.total_unread_mentions;
                } else {
                    anyUnreadThreads = anyUnreadThreads || Boolean(c.total_unread_threads);
                    totalUnreadMentions += c.total_unread_mentions;
                }
            });
        }

        return totalUnreadMentions || anyUnreadThreads || Boolean(totalUnreadMessages);
    },
);

/**
 * Return a tuple of
 * - Set of team IDs that have unread messages
 * - Map with team IDs as keys and unread mentions counts as values
 */
export const getTeamsUnreadStatuses: (state: GlobalState) => [Set<Team['id']>, Map<Team['id'], number>, Map<Team['id'], boolean>] = createSelector(
    'getTeamsUnreadStatuses',
    getAllChannels,
    getMyChannelMemberships,
    getChannelMessageCounts,
    isCollapsedThreadsEnabled,
    getThreadCounts,
    (
        channels,
        channelMemberships,
        channelMessageCounts,
        collapsedThreadsEnabled,
        teamThreadCounts,
    ) => {
        const teamUnreadsSet = new Set<Team['id']>();
        const teamMentionsMap = new Map<Team['id'], number>();
        const teamHasUrgentMap = new Map<Team['id'], boolean>();

        for (const [channelId, channelMembership] of Object.entries(channelMemberships)) {
            const channel = channels[channelId];

            if (!channel || !channelMembership) {
                continue;
            }

            // if channel is muted, we skip its count
            if (isChannelMuted(channelMembership)) {
                continue;
            }

            // We skip DMs and GMs in counting since they are accesible through Direct messages across teams
            if (channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL) {
                continue;
            }

            // If other user is deleted in a DM channel, we skip its count
            // TODO: This is a check overlap with the above condition, so it can never execute.
            // Evaluate if it some logic should be changed or if this branch should be removed.
            // if (channel.type === General.DM_CHANNEL) {
            //     const otherUserId = getUserIdFromChannelName(currentUserId, channel.name);
            //     if (users[otherUserId]?.delete_at !== 0) {
            //         continue;
            //     }
            // }

            // If channel is deleted, we skip its count
            if (channel.delete_at !== 0) {
                continue;
            }

            // Add read/unread from channel membership
            const unreadCountObjectForChannel = calculateUnreadCount(channelMessageCounts[channelId], channelMembership, collapsedThreadsEnabled);
            if (unreadCountObjectForChannel.showUnread) {
                teamUnreadsSet.add(channel.team_id);
            }

            // Add mentions count from channel membership
            if (unreadCountObjectForChannel.mentions > 0) {
                const previousMentionsInTeam = teamMentionsMap.has(channel.team_id) ? teamMentionsMap.get(channel.team_id) as number : 0;
                if (previousMentionsInTeam === 0) {
                    teamMentionsMap.set(channel.team_id, unreadCountObjectForChannel.mentions);
                } else {
                    teamMentionsMap.set(channel.team_id, unreadCountObjectForChannel.mentions + previousMentionsInTeam);
                }
            }

            // Add has urgent mentions count from channel membership
            if (unreadCountObjectForChannel.hasUrgent) {
                const previousHasUrgetInTeam = teamHasUrgentMap.has(channel.team_id) ? teamHasUrgentMap.get(channel.team_id) as boolean : false;
                if (!previousHasUrgetInTeam) {
                    teamHasUrgentMap.set(channel.team_id, unreadCountObjectForChannel.hasUrgent);
                }
            }
        }

        if (collapsedThreadsEnabled) {
            for (const teamId of Object.keys(teamThreadCounts)) {
                const threadCountsObjectForTeam = teamThreadCounts[teamId];

                // Add read/unread from global threads view for team
                if (threadCountsObjectForTeam.total_unread_threads > 0) {
                    teamUnreadsSet.add(teamId);
                }

                // Add mentions count from global threads view for team
                if (threadCountsObjectForTeam.total_unread_mentions > 0) {
                    const previousMentionsInTeam = teamMentionsMap.has(teamId) ? teamMentionsMap.get(teamId) as number : 0;
                    if (previousMentionsInTeam === 0) {
                        teamMentionsMap.set(teamId, threadCountsObjectForTeam.total_unread_mentions);
                    } else {
                        teamMentionsMap.set(teamId, threadCountsObjectForTeam.total_unread_mentions + previousMentionsInTeam);
                    }
                }

                // Add mentions count from global threads view for team
                if (threadCountsObjectForTeam.total_unread_urgent_mentions) {
                    const previousHasUrgetInTeam = teamHasUrgentMap.has(teamId) ? teamHasUrgentMap.get(teamId) as boolean : false;
                    if (!previousHasUrgetInTeam) {
                        teamHasUrgentMap.set(teamId, Boolean(threadCountsObjectForTeam.total_unread_urgent_mentions));
                    }
                }
            }
        }

        return [teamUnreadsSet, teamMentionsMap, teamHasUrgentMap];
    },
);

export const getUnreadStatusInCurrentTeam: (state: GlobalState) => BasicUnreadStatus = createSelector(
    'getUnreadStatusInCurrentTeam',
    getCurrentChannelId,
    getMyChannels,
    getMyChannelMemberships,
    getChannelMessageCounts,
    getUsers,
    getCurrentUserId,
    getCurrentTeamId,
    isCollapsedThreadsEnabled,
    getThreadCountsIncludingDirect,
    isPostPriorityEnabled,
    (
        currentChannelId,
        channels,
        myMembers,
        messageCounts,
        users,
        currentUserId,
        currentTeamId,
        collapsedThreadsEnabled,
        threadCounts,
        postPriorityEnabled,
    ) => {
        const {
            messages: currentTeamUnreadMessages,
            mentions: currentTeamUnreadMentions,
        } = channels.reduce((counts, channel) => {
            const m = myMembers[channel.id];

            if (!m || channel.id === currentChannelId) {
                return counts;
            }

            const channelExists = channel.type === General.DM_CHANNEL ? users[getUserIdFromChannelName(currentUserId, channel.name)]?.delete_at === 0 : channel.delete_at === 0;
            if (!channelExists) {
                return counts;
            }

            const mentions = collapsedThreadsEnabled ? m.mention_count_root : m.mention_count;
            if (mentions) {
                counts.mentions += mentions;
            }

            if (postPriorityEnabled) {
                counts.urgentMentions += m.urgent_mention_count;
            }

            const unreadCount = calculateUnreadCount(messageCounts[channel.id], m, collapsedThreadsEnabled);
            if (unreadCount.showUnread) {
                counts.messages += unreadCount.messages;
            }

            return counts;
        }, {
            messages: 0,
            mentions: 0,
            urgentMentions: 0,
        });

        let totalUnreadMentions = currentTeamUnreadMentions;
        let anyUnreadThreads = false;

        // when collapsed threads are enabled, we start with root-post counts from channels, then
        // add the same thread-reply counts from the global threads view IF we're not in global threads
        if (collapsedThreadsEnabled && currentChannelId) {
            const c = threadCounts[currentTeamId];
            if (c) {
                anyUnreadThreads = anyUnreadThreads || Boolean(c.total_unread_threads);
                totalUnreadMentions += c.total_unread_mentions;
            }
        }

        return totalUnreadMentions || anyUnreadThreads || Boolean(currentTeamUnreadMessages);
    },
);

export const canManageChannelMembers: (state: GlobalState) => boolean = createSelector(
    'canManageChannelMembers',
    getCurrentChannel,
    (state: GlobalState): boolean => haveICurrentChannelPermission(state,
        Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS,
    ),
    (state: GlobalState): boolean => haveICurrentChannelPermission(state,
        Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
    ),
    (
        channel: Channel | undefined,
        managePrivateMembers: boolean,
        managePublicMembers: boolean,
    ): boolean => {
        if (!channel) {
            return false;
        }

        if (channel.delete_at !== 0) {
            return false;
        }

        if (channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL || channel.name === General.DEFAULT_CHANNEL) {
            return false;
        }

        if (channel.type === General.OPEN_CHANNEL) {
            return managePublicMembers;
        } else if (channel.type === General.PRIVATE_CHANNEL) {
            return managePrivateMembers;
        }

        return true;
    },
);

// Determine if the user has permissions to manage members in at least one channel of the current team
export function canManageAnyChannelMembersInCurrentTeam(state: GlobalState): boolean {
    const myChannelMemberships = getMyChannelMemberships(state);
    const myChannelsIds = Object.keys(myChannelMemberships);
    const currentTeamId = getCurrentTeamId(state);

    for (const channelId of myChannelsIds) {
        const channel = getChannel(state, channelId);

        if (!channel || channel.team_id !== currentTeamId) {
            continue;
        }

        if (channel.type === General.OPEN_CHANNEL && haveIChannelPermission(state,
            currentTeamId,
            channelId,
            Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
        )) {
            return true;
        } else if (channel.type === General.PRIVATE_CHANNEL && haveIChannelPermission(state,
            currentTeamId,
            channelId,
            Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS,
        )) {
            return true;
        }
    }

    return false;
}

export const getAllDirectChannelIds: (state: GlobalState) => string[] = createIdsSelector(
    'getAllDirectChannelIds',
    getDirectChannelsSet,
    (directIds: Set<string>): string[] => {
        return Array.from(directIds);
    },
);

export const getChannelIdsInCurrentTeam: (state: GlobalState) => string[] = createIdsSelector(
    'getChannelIdsInCurrentTeam',
    getCurrentTeamId,
    getChannelsInTeam,
    (currentTeamId: string, channelsInTeam: RelationOneToManyUnique<Team, Channel>): string[] => {
        return Array.from(channelsInTeam[currentTeamId] || []);
    },
);

export const getChannelIdsForCurrentTeam: (state: GlobalState) => string[] = createIdsSelector(
    'getChannelIdsForCurrentTeam',
    getChannelIdsInCurrentTeam,
    getAllDirectChannelIds,
    (channels, direct) => {
        return [...channels, ...direct];
    },
);

export const getChannelIdsInAllTeams: (state: GlobalState) => string[] = createIdsSelector(
    'getChannelIdsInAllTeams',
    getChannelSetForAllTeams,
    (channels): string[] => {
        return Array.from(channels || []);
    },
);

export const getChannelIdsForAllTeams: (state: GlobalState) => string[] = createIdsSelector(
    'getChannelIdsForAllTeams',
    getChannelIdsInAllTeams,
    getAllDirectChannelIds,
    (channels, direct) => {
        return [...channels, ...direct];
    },
);

export const getUnreadChannelIds: (state: GlobalState, lastUnreadChannel?: Channel | null) => string[] = createIdsSelector(
    'getUnreadChannelIds',
    isCollapsedThreadsEnabled,
    getMyChannelMemberships,
    getChannelMessageCounts,
    getChannelIdsForCurrentTeam,
    (state: GlobalState, lastUnreadChannel: Channel | undefined | null = null): Channel | undefined | null => lastUnreadChannel,
    (
        collapsedThreads,
        members: RelationOneToOne<Channel, ChannelMembership>,
        messageCounts: RelationOneToOne<Channel, ChannelMessageCount>,
        teamChannelIds: string[],
        lastUnreadChannel?: Channel | null,
    ): string[] => {
        const unreadIds = teamChannelIds.filter((id) => {
            return calculateUnreadCount(messageCounts[id], members[id], collapsedThreads).showUnread;
        });

        if (lastUnreadChannel && members[lastUnreadChannel.id] && !unreadIds.includes(lastUnreadChannel.id)) {
            unreadIds.push(lastUnreadChannel.id);
        }

        return unreadIds;
    },
);

export const getAllTeamsUnreadChannelIds: (state: GlobalState) => string[] = createIdsSelector(
    'getAllTeamsUnreadChannelIds',
    isCollapsedThreadsEnabled,
    getMyChannelMemberships,
    getChannelMessageCounts,
    getChannelIdsForAllTeams,
    (
        collapsedThreads,
        members: RelationOneToOne<Channel, ChannelMembership>,
        messageCounts: RelationOneToOne<Channel, ChannelMessageCount>,
        allTeamsChannelIds: string[],
    ): string[] => {
        return allTeamsChannelIds.filter((id) => {
            return calculateUnreadCount(messageCounts[id], members[id], collapsedThreads).showUnread;
        });
    },
);

export const getUnreadChannels: (state: GlobalState, lastUnreadChannel?: Channel | null) => Channel[] = createIdsSelector(
    'getUnreadChannels',
    getCurrentUser,
    getUsers,
    getUserIdsInChannels,
    getAllChannels,
    getUnreadChannelIds,
    getTeammateNameDisplaySetting,
    (currentUser, profiles, userIdsInChannels: any, channels, unreadIds, settings) => {
        // If we receive an unread for a channel and then a mention the channel
        // won't be sorted correctly until we receive a message in another channel
        if (!currentUser) {
            return [];
        }

        const allUnreadChannels = unreadIds.filter((id) => channels[id] && channels[id].delete_at === 0).map((id) => {
            const c = channels[id];

            if (c.type === General.DM_CHANNEL || c.type === General.GM_CHANNEL) {
                return completeDirectChannelDisplayName(currentUser.id, profiles, userIdsInChannels[id], settings!, c);
            }

            return c;
        });
        return allUnreadChannels;
    },
);

export const getUnsortedAllTeamsUnreadChannels: (state: GlobalState) => Channel[] = createSelector(
    'getAllTeamsUnreadChannels',
    getCurrentUser,
    getUsers,
    getUserIdsInChannels,
    getAllChannels,
    getAllTeamsUnreadChannelIds,
    getTeammateNameDisplaySetting,
    (currentUser, profiles, userIdsInChannels, channels, allTeamsUnreadChannelIds, settings) => {
        // If we receive an unread for a channel and then a mention the channel
        // won't be sorted correctly until we receive a message in another channel
        if (!currentUser) {
            return [];
        }

        return allTeamsUnreadChannelIds.filter((id) => channels[id] && channels[id].delete_at === 0).map((id) => {
            const c = channels[id];

            if (c.type === General.DM_CHANNEL || c.type === General.GM_CHANNEL) {
                return completeDirectChannelDisplayName(currentUser.id, profiles, userIdsInChannels[id], settings!, c);
            }

            return c;
        });
    },
);

export const sortUnreadChannels = (
    channels: Channel[],
    myMembers: RelationOneToOne<Channel, ChannelMembership>,
    lastUnreadChannel: (Channel & {hadMentions: boolean}) | null,
    crtEnabled: boolean,
) => {
    function isMuted(channel: Channel) {
        return isChannelMuted(myMembers[channel.id]);
    }

    function hasMentions(channel: Channel) {
        if (lastUnreadChannel && channel.id === lastUnreadChannel.id && lastUnreadChannel.hadMentions) {
            return true;
        }

        const member = myMembers[channel.id];
        return member?.mention_count !== 0;
    }

    // Sort channels with mentions first and then sort by recency
    return [...channels].sort((a, b) => {
        // Sort muted channels last
        if (isMuted(a) && !isMuted(b)) {
            return 1;
        } else if (!isMuted(a) && isMuted(b)) {
            return -1;
        }

        // Sort non-muted mentions first
        if (hasMentions(a) && !hasMentions(b)) {
            return -1;
        } else if (!hasMentions(a) && hasMentions(b)) {
            return 1;
        }

        const aLastPostAt = max([crtEnabled ? a.last_root_post_at : a.last_post_at, a.create_at]) || 0;
        const bLastPostAt = max([crtEnabled ? b.last_root_post_at : b.last_post_at, b.create_at]) || 0;

        return bLastPostAt - aLastPostAt;
    });
};

export const getSortedAllTeamsUnreadChannels: (state: GlobalState) => Channel[] = createSelector(
    'getSortedAllTeamsUnreadChannels',
    getUnsortedAllTeamsUnreadChannels,
    getMyChannelMemberships,
    isCollapsedThreadsEnabled,
    (channels, myMembers, crtEnabled) => {
        return sortUnreadChannels(channels, myMembers, null, crtEnabled);
    },
);

// getDirectAndGroupChannels returns all direct and group channels, even if they have been manually
// or automatically closed.
//
// This is similar to the getAllDirectChannels above which actually also returns group channels,
// but suppresses manually closed group channels but not manually closed direct channels. This
// method does away with all the suppression, since the webapp client downstream uses this for
// the channel switcher and puts such suppressed channels in a separate category.
export const getDirectAndGroupChannels: (a: GlobalState) => Channel[] = createSelector(
    'getDirectAndGroupChannels',
    getCurrentUser,
    getUsers,
    getUserIdsInChannels,
    getAllChannels,
    getTeammateNameDisplaySetting,
    (currentUser: UserProfile, profiles: IDMappedObjects<UserProfile>, userIdsInChannels: any, channels: IDMappedObjects<Channel>, settings): Channel[] => {
        if (!currentUser) {
            return [];
        }

        return Object.keys(channels).
            map((key) => channels[key]).
            filter((channel: Channel): boolean => Boolean(channel)).
            filter((channel: Channel): boolean => channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL).
            map((channel: Channel): Channel => completeDirectChannelDisplayName(currentUser.id, profiles, userIdsInChannels[channel.id], settings!, channel));
    },
);

const getProfiles = (currentUserId: string, usersIdsInChannel: Set<string>, users: IDMappedObjects<UserProfile>): UserProfile[] => {
    const profiles: UserProfile[] = [];
    usersIdsInChannel.forEach((userId) => {
        if (userId !== currentUserId) {
            profiles.push(users[userId]);
        }
    });
    return profiles;
};

/**
 * Returns an array of unsorted group channels, each with an array of the user profiles in the channel attached to them.
 */
export const getChannelsWithUserProfiles: (state: GlobalState) => Array<{
    profiles: UserProfile[];
} & Channel> = createSelector(
    'getChannelsWithUserProfiles',
    getUserIdsInChannels,
    getUsers,
    getGroupChannels,
    getCurrentUserId,
    (channelUserMap: RelationOneToManyUnique<Channel, UserProfile>, users: IDMappedObjects<UserProfile>, channels: Channel[], currentUserId: string) => {
        return channels.map((channel: Channel): {
            profiles: UserProfile[];
        } & Channel => {
            const profiles = getProfiles(currentUserId, channelUserMap[channel.id] || new Set(), users);
            return {
                ...channel,
                profiles,
            };
        });
    },
);

export const getDefaultChannelForTeams: (state: GlobalState) => RelationOneToOne<Team, Channel> = createSelector(
    'getDefaultChannelForTeams',
    getAllChannels,
    (channels: IDMappedObjects<Channel>): RelationOneToOne<Team, Channel> => {
        const result: RelationOneToOne<Team, Channel> = {};

        for (const channel of Object.keys(channels).map((key) => channels[key])) {
            if (channel && channel.name === General.DEFAULT_CHANNEL) {
                result[channel.team_id] = channel;
            }
        }

        return result;
    },
);

export const getMyFirstChannelForTeams: (state: GlobalState) => RelationOneToOne<Team, Channel> = createSelector(
    'getMyFirstChannelForTeams',
    getAllChannels,
    getMyChannelMemberships,
    getMyTeams,
    getCurrentUser,
    (allChannels: IDMappedObjects<Channel>, myChannelMemberships: RelationOneToOne<Channel, ChannelMembership>, myTeams: Team[], currentUser: UserProfile): RelationOneToOne<Team, Channel> => {
        const locale = currentUser.locale || General.DEFAULT_LOCALE;
        const result: RelationOneToOne<Team, Channel> = {};

        for (const team of myTeams) {
        // Get a sorted array of all channels in the team that the current user is a member of
            const teamChannels = Object.values(allChannels).filter((channel: Channel) => channel && channel.team_id === team.id && Boolean(myChannelMemberships[channel.id])).sort(sortChannelsByDisplayName.bind(null, locale));

            if (teamChannels.length === 0) {
                continue;
            }

            result[team.id] = teamChannels[0];
        }

        return result;
    },
);

export const getRedirectChannelNameForCurrentTeam = (state: GlobalState): string => {
    const currentTeamId = getCurrentTeamId(state);
    return getRedirectChannelNameForTeam(state, currentTeamId);
};

export const getRedirectChannelNameForTeam = (state: GlobalState, teamId: string): string => {
    const defaultChannelForTeam = getDefaultChannelForTeams(state)[teamId];
    const canIJoinPublicChannelsInTeam = haveITeamPermission(state,
        teamId,
        Permissions.JOIN_PUBLIC_CHANNELS,
    );
    const myChannelMemberships = getMyChannelMemberships(state);
    const iAmMemberOfTheTeamDefaultChannel = Boolean(defaultChannelForTeam && myChannelMemberships[defaultChannelForTeam.id]);

    if (iAmMemberOfTheTeamDefaultChannel || canIJoinPublicChannelsInTeam) {
        return General.DEFAULT_CHANNEL;
    }

    const myFirstChannelForTeam = getMyFirstChannelForTeams(state)[teamId];

    return (myFirstChannelForTeam && myFirstChannelForTeam.name) || General.DEFAULT_CHANNEL;
};

// isManually unread looks into state if the provided channelId is marked as unread by the user.
export function isManuallyUnread(state: GlobalState, channelId?: string): boolean {
    if (!channelId) {
        return false;
    }

    return Boolean(state.entities.channels.manuallyUnread[channelId]);
}

export function getChannelModerations(state: GlobalState, channelId: string): ChannelModeration[] {
    return state.entities.channels.channelModerations[channelId];
}

const EMPTY_OBJECT = {};
export function getChannelMemberCountsByGroup(state: GlobalState, channelId?: string): ChannelMemberCountsByGroup {
    if (!channelId) {
        return EMPTY_OBJECT;
    }
    return state.entities.channels.channelMemberCountsByGroup[channelId] || EMPTY_OBJECT;
}

export function isFavoriteChannel(state: GlobalState, channelId: string): boolean {
    const channel = getChannel(state, channelId);
    if (!channel) {
        return false;
    }

    const category = getCategoryInTeamByType(state, channel.team_id || getCurrentTeamId(state), CategoryTypes.FAVORITES);

    if (!category) {
        return false;
    }

    return category.channel_ids.includes(channel.id);
}

export function filterChannelList(channelList: Channel[], filters: ChannelSearchOpts): Channel[] {
    if (!filters || (!filters.private && !filters.public && !filters.deleted && !filters.team_ids)) {
        return channelList;
    }
    let result: Channel[] = [];
    const channelType: string[] = [];
    const channels = channelList;
    if (filters.public) {
        channelType.push(General.OPEN_CHANNEL);
    }
    if (filters.private) {
        channelType.push(General.PRIVATE_CHANNEL);
    }
    if (filters.deleted) {
        channelType.push(General.ARCHIVED_CHANNEL);
    }
    channelType.forEach((type) => {
        result = result.concat(channels.filter((channel) => channel.type === type));
    });
    if (filters.team_ids && filters.team_ids.length > 0) {
        let teamResult: Channel[] = [];
        filters.team_ids.forEach((id) => {
            if (channelType.length > 0) {
                const filterResult = result.filter((channel) => channel.team_id === id);
                teamResult = teamResult.concat(filterResult);
            } else {
                teamResult = teamResult.concat(channels.filter((channel) => channel.team_id === id));
            }
        });
        result = teamResult;
    }
    return result;
}
export function searchChannelsInPolicy(state: GlobalState, policyId: string, term: string, filters: ChannelSearchOpts): Channel[] {
    const channelsInPolicy = getChannelsInPolicy();
    const channelArray = channelsInPolicy(state, {policyId});
    let channels = filterChannelList(channelArray, filters);
    channels = filterChannelsMatchingTerm(channels, term);

    return channels;
}

export function getDirectTeammate(state: GlobalState, channelId: string): UserProfile | undefined {
    const channel = getChannel(state, channelId);
    if (!channel || channel.type !== 'D') {
        return undefined;
    }

    const userIds = channel.name.split('__');
    const currentUserId = getCurrentUserId(state);

    if (userIds.length !== 2 || userIds.indexOf(currentUserId) === -1) {
        return undefined;
    }

    if (userIds[0] === userIds[1]) {
        return getUser(state, userIds[0]);
    }

    for (const id of userIds) {
        if (id !== currentUserId) {
            return getUser(state, id);
        }
    }

    return undefined;
}

export function makeGetGmChannelMemberCount(): (state: GlobalState, channel: Channel) => number {
    return createSelector(
        'getChannelMemberCount',
        getUserIdsInChannels,
        getCurrentUserId,
        (_state: GlobalState, channel: Channel) => channel,
        (memberIds, userId, channel) => {
            let membersCount = 0;
            if (memberIds && memberIds[channel.id]) {
                const groupMemberIds: Set<string> = memberIds[channel.id] as unknown as Set<string>;
                membersCount = groupMemberIds.size;
                if (groupMemberIds.has(userId)) {
                    membersCount--;
                }
            }

            return membersCount;
        },
    );
}

export const getMyActiveChannelIds = createSelector(
    'getMyActiveChannels',
    getMyChannels,
    (channels) => channels.flatMap((chan) => {
        if (chan.delete_at > 0) {
            return [];
        }
        return chan.id;
    }),
);
export const getRecentProfilesFromDMs: (state: GlobalState) => UserProfile[] = createSelector(
    'getRecentProfilesFromDMs',
    getAllChannels,
    getUsers,
    getCurrentUser,
    getMyChannelMemberships,
    (allChannels: IDMappedObjects<Channel>, users: IDMappedObjects<UserProfile>, currentUser: UserProfile, memberships: RelationOneToOne<Channel, ChannelMembership>) => {
        if (!allChannels || !users) {
            return [];
        }
        const recentChannelIds = Object.values(memberships).sort((aMembership, bMembership) => {
            return bMembership.last_viewed_at - aMembership.last_viewed_at;
        }).map((membership) => membership.channel_id);
        const groupChannels = Object.values(allChannels).filter((channel: Channel) => channel.type === General.GM_CHANNEL);
        const dmChannels = Object.values(allChannels).filter((channel: Channel) => channel.type === General.DM_CHANNEL);

        const userProfilesByChannel: {[key: string]: UserProfile[]} = {};

        dmChannels.forEach((channel) => {
            if (channel.name) {
                const otherUserId = getUserIdFromChannelName(currentUser.id, channel.name);
                const userProfile = users[otherUserId];
                if (userProfile) {
                    userProfilesByChannel[channel.id] = [userProfile];
                }
            }
        });

        groupChannels.forEach((channel) => {
            if (channel.display_name) {
                const memberUsernames = channel.display_name.split(',').map((username) => username.trim()).filter((username) => username !== currentUser.username).sort();
                const memberProfiles = memberUsernames.map((username) => {
                    return Object.values(users).find((profile) => profile.username === username);
                });
                if (memberProfiles) {
                    userProfilesByChannel[channel.id] = memberProfiles as UserProfile[];
                }
            }
        });
        const sortedUserProfiles: Set<UserProfile> = new Set<UserProfile>();
        recentChannelIds.forEach((cid: string) => {
            if (userProfilesByChannel[cid]) {
                userProfilesByChannel[cid].forEach((user) => sortedUserProfiles.add(user));
            }
        });
        return [...sortedUserProfiles];
    },
);

export const isDeactivatedDirectChannel = (state: GlobalState, channelId: string) => {
    const teammate = getDirectTeammate(state, channelId);
    return Boolean(teammate && teammate.delete_at);
};

export function getChannelBanner(state: GlobalState, channelId: string): ChannelBanner | undefined {
    const channel = getChannel(state, channelId);
    return channel ? channel.banner_info : undefined;
}
