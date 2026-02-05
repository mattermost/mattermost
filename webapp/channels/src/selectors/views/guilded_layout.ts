// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {getAllChannels, getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import {getPostsInChannel} from 'mattermost-redux/selectors/entities/posts';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getUsers, getStatusForUserId, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

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
