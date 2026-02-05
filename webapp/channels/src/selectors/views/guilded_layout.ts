// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {getAllChannels, getMyChannelMemberships, getChannelMembersInChannels} from 'mattermost-redux/selectors/entities/channels';
import {getPostsInChannel, getPost} from 'mattermost-redux/selectors/entities/posts';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getUsers, getStatusForUserId, getCurrentUserId, makeGetProfilesInChannel} from 'mattermost-redux/selectors/entities/users';
import {getThreads} from 'mattermost-redux/selectors/entities/threads';

import type {Post} from '@mattermost/types/posts';

import {Constants} from 'utils/constants';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {GlobalState} from 'types/store';

/**
 * Returns true if ThreadsInSidebar behavior should be active.
 * This is true if either:
 * - ThreadsInSidebar feature flag is enabled, OR
 * - GuildedChatLayout feature flag is enabled (auto-enables ThreadsInSidebar)
 */
export const isThreadsInSidebarActive = createSelector(
    'isThreadsInSidebarActive',
    getConfig,
    (config): boolean => {
        return (
            config.FeatureFlagThreadsInSidebar === 'true' ||
            config.FeatureFlagGuildedChatLayout === 'true'
        );
    },
);

/**
 * Returns true if the full Guilded layout is enabled (feature flag only, ignores viewport).
 */
export const isGuildedLayoutEnabled = createSelector(
    'isGuildedLayoutEnabled',
    getConfig,
    (config): boolean => {
        return config.FeatureFlagGuildedChatLayout === 'true';
    },
);

/**
 * Returns the mobile breakpoint for Guilded layout.
 */
export const GUILDED_MOBILE_BREAKPOINT = 768;

// Guilded layout view state selectors
export const getGuildedLayoutState = (state: GlobalState) => state.views.guildedLayout;

export const isTeamSidebarExpanded = createSelector(
    'isTeamSidebarExpanded',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.isTeamSidebarExpanded ?? false,
);

export const isDmMode = createSelector(
    'isDmMode',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.isDmMode ?? false,
);

export const getRhsActiveTab = createSelector(
    'getRhsActiveTab',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.rhsActiveTab ?? 'members',
);

export const getActiveModal = createSelector(
    'getActiveModal',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.activeModal ?? null,
);

export const getModalData = createSelector(
    'getModalData',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.modalData ?? {},
);

// Favorited team IDs selector
export const getFavoritedTeamIds = createSelector(
    'getFavoritedTeamIds',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.favoritedTeamIds ?? [],
);

// Unread DM types
interface UnreadDmInfo {
    channel: Channel;
    user: UserProfile;
    unreadCount: number;
    status: string;
}

/**
 * Get total count of unread DM/GM messages
 */
export const getUnreadDmCount = createSelector(
    'getUnreadDmCount',
    getAllChannels,
    getMyChannelMemberships,
    (channels, memberships): number => {
        let count = 0;
        for (const channel of Object.values(channels)) {
            // Only count DM and GM channels
            if (channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL) {
                continue;
            }
            const membership = memberships[channel.id];
            if (membership && membership.mention_count > 0) {
                count += membership.mention_count;
            }
        }
        return count;
    },
);

/**
 * Get unread DM channels with user info, sorted by most recent
 */
export const getUnreadDmChannelsWithUsers = createSelector(
    'getUnreadDmChannelsWithUsers',
    getAllChannels,
    getMyChannelMemberships,
    getUsers,
    getCurrentUserId,
    (state: GlobalState) => state,
    (channels, memberships, users, currentUserId, state): UnreadDmInfo[] => {
        const unreadDms: UnreadDmInfo[] = [];

        for (const channel of Object.values(channels)) {
            // Only process DM channels (not GM for now)
            if (channel.type !== Constants.DM_CHANNEL) {
                continue;
            }

            const membership = memberships[channel.id];
            if (!membership || membership.mention_count === 0) {
                continue;
            }

            // Extract other user's ID from DM channel name
            // DM channel names are formatted as "{oderId}__{currentUserId}" or vice versa
            const userIds = channel.name.split('__');
            const otherUserId = userIds.find((id) => users[id] && id !== currentUserId);

            if (!otherUserId || !users[otherUserId]) {
                continue;
            }

            const user = users[otherUserId];
            const status = getStatusForUserId(state, otherUserId) || 'offline';

            unreadDms.push({
                channel,
                user,
                unreadCount: membership.mention_count,
                status,
            });
        }

        // Sort by last post time (most recent first)
        return unreadDms.sort((a, b) => b.channel.last_post_at - a.channel.last_post_at);
    },
);

/**
 * Get the last post in a channel for preview purposes.
 * Returns the most recent post or null if no posts.
 */
export function getLastPostInChannel(state: GlobalState, channelId: string) {
    const posts = getPostsInChannel(state, channelId) || [];
    if (posts.length === 0) {
        return null;
    }
    // Posts are ordered newest first
    return posts[0];
}

// DM list types
interface DmInfo {
    type: 'dm';
    channel: Channel;
    user: UserProfile;
}

interface GroupDmInfo {
    type: 'group';
    channel: Channel;
    users: UserProfile[];
}

type DmOrGroupDm = DmInfo | GroupDmInfo;

/**
 * Get all DM and Group DM channels with user info, sorted by last activity.
 * Used for the DM list page in Guilded layout.
 */
export const getAllDmChannelsWithUsers = createSelector(
    'getAllDmChannelsWithUsers',
    getAllChannels,
    getMyChannelMemberships,
    getUsers,
    getCurrentUserId,
    (channels, memberships, users, currentUserId): DmOrGroupDm[] => {
        const dms: DmOrGroupDm[] = [];

        for (const channel of Object.values(channels)) {
            // Only include channels user is a member of
            if (!memberships[channel.id]) {
                continue;
            }

            if (channel.type === Constants.DM_CHANNEL) {
                // Extract other user's ID from DM channel name
                const userIds = channel.name.split('__');
                const otherUserId = userIds.find((id) => id !== currentUserId);

                if (!otherUserId || !users[otherUserId]) {
                    continue;
                }

                dms.push({
                    type: 'dm',
                    channel,
                    user: users[otherUserId],
                });
            } else if (channel.type === Constants.GM_CHANNEL) {
                // Group message - get users from display_name parsing
                const gmUsers: UserProfile[] = [];

                // GM display_name is typically comma-separated usernames
                const displayNames = channel.display_name.split(', ');
                for (const displayName of displayNames) {
                    const user = Object.values(users).find(
                        (u) => u.username === displayName ||
                               u.nickname === displayName ||
                               `${u.first_name} ${u.last_name}` === displayName,
                    );
                    if (user && user.id !== currentUserId) {
                        gmUsers.push(user);
                    }
                }

                if (gmUsers.length > 0) {
                    dms.push({
                        type: 'group',
                        channel,
                        users: gmUsers,
                    });
                }
            }
        }

        // Sort by last post time (most recent first)
        return dms.sort((a, b) => b.channel.last_post_at - a.channel.last_post_at);
    },
);

// Members tab types
interface MemberWithStatus {
    user: UserProfile;
    status: string;
    isAdmin: boolean;
}

interface GroupedMembers {
    onlineAdmins: MemberWithStatus[];
    onlineMembers: MemberWithStatus[];
    offline: MemberWithStatus[];
}

// Create reusable selector instance from factory
const getProfilesInChannel = makeGetProfilesInChannel();

/**
 * Get channel members grouped by status (online admins, online members, offline)
 * Used for the Members tab in Persistent RHS
 */
export const getChannelMembersGroupedByStatus = createSelector(
    'getChannelMembersGroupedByStatus',
    (state: GlobalState, channelId: string) => getProfilesInChannel(state, channelId),
    (state: GlobalState, channelId: string) => getChannelMembersInChannels(state)?.[channelId],
    (state: GlobalState) => state,
    (profiles, memberships, state): GroupedMembers | null => {
        if (!profiles || !memberships) {
            return null;
        }

        const result: GroupedMembers = {
            onlineAdmins: [],
            onlineMembers: [],
            offline: [],
        };

        for (const user of profiles) {
            const membership = memberships[user.id];
            const status = getStatusForUserId(state, user.id) || 'offline';
            const isAdmin = membership?.scheme_admin === true;
            const isOnline = status !== 'offline';

            const memberInfo: MemberWithStatus = {
                user,
                status,
                isAdmin,
            };

            if (!isOnline) {
                result.offline.push(memberInfo);
            } else if (isAdmin) {
                result.onlineAdmins.push(memberInfo);
            } else {
                result.onlineMembers.push(memberInfo);
            }
        }

        // Sort each group alphabetically by display name
        const sortByName = (a: MemberWithStatus, b: MemberWithStatus) => {
            const nameA = a.user.nickname || a.user.username;
            const nameB = b.user.nickname || b.user.username;
            return nameA.localeCompare(nameB);
        };

        result.onlineAdmins.sort(sortByName);
        result.onlineMembers.sort(sortByName);
        result.offline.sort(sortByName);

        return result;
    },
);

// Thread info type for RHS
interface ThreadInfo {
    id: string;
    rootPost: Post;
    replyCount: number;
    participants: string[];
    hasUnread: boolean;
}

/**
 * Get threads in a channel with metadata
 * Used for the Threads tab in Persistent RHS
 */
export const getThreadsInChannel = createSelector(
    'getThreadsInChannel',
    (state: GlobalState) => getThreads(state),
    (state: GlobalState, channelId: string) => channelId,
    (state: GlobalState) => state,
    (threads, channelId, state): ThreadInfo[] => {
        const channelThreads: ThreadInfo[] = [];

        for (const [threadId, thread] of Object.entries(threads?.threads || {})) {
            if (!thread) {
                continue;
            }

            const rootPost = getPost(state, threadId);
            if (!rootPost || rootPost.channel_id !== channelId) {
                continue;
            }

            channelThreads.push({
                id: threadId,
                rootPost,
                replyCount: thread.reply_count || 0,
                participants: thread.participants?.map((p: {id: string}) => p.id) || [],
                hasUnread: (thread.unread_replies || 0) > 0,
            });
        }

        // Sort by last reply time (most recent first)
        return channelThreads.sort((a, b) =>
            (b.rootPost.last_reply_at || 0) - (a.rootPost.last_reply_at || 0),
        );
    },
);
