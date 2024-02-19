// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel, ChannelType, ChannelMembership, ChannelNotifyProps, ChannelMessageCount} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';
import type {UsersState, UserProfile, UserNotifyProps} from '@mattermost/types/users';
import type {IDMappedObjects, RelationOneToManyUnique, RelationOneToOne} from '@mattermost/types/utilities';

import {MarkUnread} from 'mattermost-redux/constants/channels';

import {displayUsername} from './user_utils';

import {General, Users} from '../constants';

const channelTypeOrder: Record<ChannelType, number> = {
    [General.OPEN_CHANNEL]: 0,
    [General.PRIVATE_CHANNEL]: 1,
    [General.DM_CHANNEL]: 2,
    [General.GM_CHANNEL]: 3,
} as Record<ChannelType, number>;

export function completeDirectChannelInfo(usersState: UsersState, teammateNameDisplay: string, channel: Channel): Channel {
    if (isDirectChannel(channel)) {
        const teammateId = getUserIdFromChannelName(usersState.currentUserId, channel.name);

        // return empty string instead of `someone` default string for display_name
        return {
            ...channel,
            display_name: displayUsername(usersState.profiles[teammateId], teammateNameDisplay, false),
            teammate_id: teammateId,
            status: usersState.statuses[teammateId] || 'offline',
        };
    } else if (isGroupChannel(channel)) {
        return completeDirectGroupInfo(usersState, teammateNameDisplay, channel);
    }

    return channel;
}

export function splitRoles(roles: string): Set<string> {
    return roles ? new Set<string>(roles.split(' ')) : new Set<string>([]);
}

// newCompleteDirectChannelInfo is a variant of completeDirectChannelInfo that accepts the minimal
// data required instead of depending on the entirety of state.entities.users. This allows the
// calling selector to have fewer dependencies, reducing its need to recompute when memoized.
//
// Ideally, this would replace completeDirectChannelInfo altogether, but is currently factored out
// to minimize changes while addressing a critical performance issue.
export function newCompleteDirectChannelInfo(currentUserId: string, profiles: IDMappedObjects<UserProfile>, profilesInChannel: RelationOneToManyUnique<Channel, UserProfile>, teammateStatus: string, teammateNameDisplay: string, channel: Channel): Channel {
    if (isDirectChannel(channel)) {
        const teammateId = getUserIdFromChannelName(currentUserId, channel.name);

        // return empty string instead of `someone` default string for display_name
        return {
            ...channel,
            display_name: displayUsername(profiles[teammateId], teammateNameDisplay, false),
            teammate_id: teammateId,
            status: teammateStatus,
        };
    } else if (isGroupChannel(channel)) {
        return newCompleteDirectGroupInfo(currentUserId, profiles, profilesInChannel, teammateNameDisplay, channel);
    }

    return channel;
}

export function completeDirectChannelDisplayName(currentUserId: string, profiles: IDMappedObjects<UserProfile>, userIdsInChannel: Set<string>, teammateNameDisplay: string, channel: Channel): Channel {
    if (isDirectChannel(channel)) {
        const dmChannelClone = {...channel};
        const teammateId = getUserIdFromChannelName(currentUserId, channel.name);

        return Object.assign(dmChannelClone, {display_name: displayUsername(profiles[teammateId], teammateNameDisplay)});
    } else if (isGroupChannel(channel) && userIdsInChannel && userIdsInChannel.size > 0) {
        const displayName = getGroupDisplayNameFromUserIds(userIdsInChannel, profiles, currentUserId, teammateNameDisplay);
        return {...channel, display_name: displayName};
    }

    return channel;
}

export function cleanUpUrlable(input: string): string {
    let cleaned = input.trim().replace(/-/g, ' ').replace(/[^\w\s]/gi, '').toLowerCase().replace(/\s/g, '-');
    cleaned = cleaned.replace(/-{2,}/, '-');
    cleaned = cleaned.replace(/^-+/, '');
    cleaned = cleaned.replace(/-+$/, '');
    return cleaned;
}

export function getChannelByName(channels: IDMappedObjects<Channel>, name: string): Channel | undefined {
    return Object.values(channels).find((channel) => channel.name === name);
}

export function getDirectChannelName(id: string, otherId: string): string {
    let handle;

    if (otherId > id) {
        handle = id + '__' + otherId;
    } else {
        handle = otherId + '__' + id;
    }

    return handle;
}

export function getUserIdFromChannelName(userId: string, channelName: string): string {
    const ids = channelName.split('__');
    let otherUserId = '';
    if (ids[0] === userId) {
        otherUserId = ids[1];
    } else {
        otherUserId = ids[0];
    }

    return otherUserId;
}

export function isDirectChannel(channel: Channel): boolean {
    return channel.type === General.DM_CHANNEL;
}

export function isGroupChannel(channel: Channel): boolean {
    return channel.type === General.GM_CHANNEL;
}

export function getChannelsIdForTeam(state: GlobalState, teamId: string): string[] {
    const {channels} = state.entities.channels;

    return Object.keys(channels).map((key) => channels[key]).reduce((res, channel: Channel) => {
        if (channel.team_id === teamId) {
            res.push(channel.id);
        }
        return res;
    }, [] as string[]);
}

export function getGroupDisplayNameFromUserIds(userIds: Set<string>, profiles: IDMappedObjects<UserProfile>, currentUserId: string, teammateNameDisplay: string, omitCurrentUser = true): string {
    const names: string[] = [];
    userIds.forEach((id) => {
        if (!(id === currentUserId && omitCurrentUser)) {
            names.push(displayUsername(profiles[id], teammateNameDisplay));
        }
    });

    function sortUsernames(a: string, b: string) {
        const locale = getUserLocale(currentUserId, profiles);
        return a.localeCompare(b, locale, {numeric: true});
    }

    return names.sort(sortUsernames).join(', ');
}

export function isDefault(channel: Channel): boolean {
    return channel.name === General.DEFAULT_CHANNEL;
}

export function completeDirectGroupInfo(usersState: UsersState, teammateNameDisplay: string, channel: Channel, omitCurrentUser = true) {
    const {currentUserId, profiles, profilesInChannel} = usersState;
    const profilesIds = profilesInChannel[channel.id];
    const gm = {...channel};

    if (profilesIds) {
        gm.display_name = getGroupDisplayNameFromUserIds(profilesIds, profiles, currentUserId, teammateNameDisplay, omitCurrentUser);
        return gm;
    }

    const usernames = gm.display_name.split(', ');
    const users = Object.keys(profiles).map((key) => profiles[key]);
    const userIds: Set<string> = new Set();
    usernames.forEach((username: string) => {
        const u = users.find((p): boolean => p.username === username);
        if (u) {
            userIds.add(u.id);
        }
    });
    if (usernames.length === userIds.size) {
        gm.display_name = getGroupDisplayNameFromUserIds(userIds, profiles, currentUserId, teammateNameDisplay);
        return gm;
    }

    return channel;
}

// newCompleteDirectGroupInfo is a variant of completeDirectGroupInfo that accepts the minimal
// data required instead of depending on the entirety of state.entities.users. This allows the
// calling selector to have fewer dependencies, reducing its need to recompute when memoized.
//
// See also newCompleteDirectChannelInfo.
function newCompleteDirectGroupInfo(currentUserId: string, profiles: IDMappedObjects<UserProfile>, profilesInChannel: RelationOneToManyUnique<Channel, UserProfile>, teammateNameDisplay: string, channel: Channel) {
    const profilesIds = profilesInChannel[channel.id];
    const gm = {...channel};

    if (profilesIds) {
        gm.display_name = getGroupDisplayNameFromUserIds(profilesIds, profiles, currentUserId, teammateNameDisplay);
        return gm;
    }

    const usernames = gm.display_name.split(', ');
    const users = Object.keys(profiles).map((key) => profiles[key]);
    const userIds: Set<string> = new Set();
    usernames.forEach((username: string) => {
        const u = users.find((p): boolean => p.username === username);
        if (u) {
            userIds.add(u.id);
        }
    });
    if (usernames.length === userIds.size) {
        gm.display_name = getGroupDisplayNameFromUserIds(userIds, profiles, currentUserId, teammateNameDisplay);
        return gm;
    }

    return channel;
}

export function isOpenChannel(channel: Channel): boolean {
    return channel.type === General.OPEN_CHANNEL;
}

export function isPrivateChannel(channel: Channel): boolean {
    return channel.type === General.PRIVATE_CHANNEL;
}

export function sortChannelsByTypeListAndDisplayName(locale: string, typeList: string[], a: Channel, b: Channel): number {
    const idxA = typeList.indexOf(a.type);
    const idxB = typeList.indexOf(b.type);

    if (idxA === -1 && idxB !== -1) {
        return 1;
    }
    if (idxB === -1 && idxA !== -1) {
        return -1;
    }

    if (idxA !== idxB) {
        if (idxA < idxB) {
            return -1;
        }
        return 1;
    }

    const aDisplayName = filterName(a.display_name);
    const bDisplayName = filterName(b.display_name);

    if (aDisplayName !== bDisplayName) {
        return aDisplayName.toLowerCase().localeCompare(bDisplayName.toLowerCase(), locale, {numeric: true});
    }

    return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), locale, {numeric: true});
}

export function sortChannelsByTypeAndDisplayName(locale: string, a: Channel, b: Channel): number {
    if (channelTypeOrder[a.type] !== channelTypeOrder[b.type]) {
        if (channelTypeOrder[a.type] < channelTypeOrder[b.type]) {
            return -1;
        }

        return 1;
    }

    const aDisplayName = filterName(a.display_name);
    const bDisplayName = filterName(b.display_name);

    if (aDisplayName !== bDisplayName) {
        return aDisplayName.toLowerCase().localeCompare(bDisplayName.toLowerCase(), locale, {numeric: true});
    }

    return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), locale, {numeric: true});
}

function filterName(name: string): string {
    return name.replace(/[.,'"\/#!$%\^&\*;:{}=\-_`~()]/g, ''); // eslint-disable-line no-useless-escape
}

export function sortChannelsByDisplayName(locale: string, a: Channel, b: Channel): number {
    // if both channels have the display_name defined
    if (a.display_name && b.display_name && a.display_name !== b.display_name) {
        return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase(), locale, {numeric: true});
    }

    return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), locale, {numeric: true});
}

export function sortChannelsByDisplayNameAndMuted(locale: string, members: RelationOneToOne<Channel, ChannelMembership>, a: Channel, b: Channel): number {
    const aMember = members[a.id];
    const bMember = members[b.id];

    if (isChannelMuted(bMember) === isChannelMuted(aMember)) {
        return sortChannelsByDisplayName(locale, a, b);
    }

    if (!isChannelMuted(bMember) && isChannelMuted(aMember)) {
        return 1;
    }

    return -1;
}

export function sortChannelsByRecency(lastPosts: RelationOneToOne<Channel, Post>, a: Channel, b: Channel): number {
    let aLastPostAt = a.last_post_at;
    if (lastPosts[a.id] && lastPosts[a.id].create_at > a.last_post_at) {
        aLastPostAt = lastPosts[a.id].create_at;
    }

    let bLastPostAt = b.last_post_at;
    if (lastPosts[b.id] && lastPosts[b.id].create_at > b.last_post_at) {
        bLastPostAt = lastPosts[b.id].create_at;
    }

    return bLastPostAt - aLastPostAt;
}

export function isChannelMuted(member?: ChannelMembership): boolean {
    return member?.notify_props ? (member.notify_props.mark_unread === MarkUnread.MENTION) : false;
}

export function areChannelMentionsIgnored(channelMemberNotifyProps: ChannelNotifyProps, currentUserNotifyProps: UserNotifyProps) {
    let ignoreChannelMentionsDefault = Users.IGNORE_CHANNEL_MENTIONS_OFF;

    if (currentUserNotifyProps.channel && currentUserNotifyProps.channel === 'false') {
        ignoreChannelMentionsDefault = Users.IGNORE_CHANNEL_MENTIONS_ON;
    }

    let ignoreChannelMentions = channelMemberNotifyProps && channelMemberNotifyProps.ignore_channel_mentions;
    if (!ignoreChannelMentions || ignoreChannelMentions === Users.IGNORE_CHANNEL_MENTIONS_DEFAULT) {
        ignoreChannelMentions = ignoreChannelMentionsDefault as any;
    }

    return ignoreChannelMentions !== Users.IGNORE_CHANNEL_MENTIONS_OFF;
}

function getUserLocale(userId: string, profiles: IDMappedObjects<UserProfile>) {
    let locale = General.DEFAULT_LOCALE;
    if (profiles && profiles[userId] && profiles[userId].locale) {
        locale = profiles[userId].locale;
    }

    return locale;
}

export function filterChannelsMatchingTerm(channels: Channel[], term: string): Channel[] {
    const lowercasedTerm = term.toLowerCase();

    return channels.filter((channel: Channel): boolean => {
        if (!channel) {
            return false;
        }
        const name = (channel.name || '').toLowerCase();
        const displayName = (channel.display_name || '').toLowerCase();

        return name.startsWith(lowercasedTerm) ||
            displayName.startsWith(lowercasedTerm);
    });
}

export function channelListToMap(channelList: Channel[]): IDMappedObjects<Channel> {
    const channels: Record<string, Channel> = {};
    for (let i = 0; i < channelList.length; i++) {
        channels[channelList[i].id] = channelList[i];
    }
    return channels;
}

// calculateUnreadCount returns an object containing the number of unread mentions/mesasges in a channel and whether
// or not that channel would be shown as unread in the sidebar.
export function calculateUnreadCount(
    messageCount: ChannelMessageCount | undefined,
    member: ChannelMembership | null | undefined,
    crtEnabled: boolean,
): {showUnread: boolean; mentions: number; messages: number; hasUrgent: boolean} {
    if (!member || !messageCount) {
        return {
            showUnread: false,
            hasUrgent: false,
            mentions: 0,
            messages: 0,
        };
    }

    let messages;
    let mentions;
    let hasUrgent = false;
    if (crtEnabled) {
        messages = messageCount.root - member.msg_count_root;
        mentions = member.mention_count_root;
    } else {
        mentions = member.mention_count;
        messages = messageCount.total - member.msg_count;
    }
    if (member.urgent_mention_count) {
        hasUrgent = true;
    }

    return {
        showUnread: mentions > 0 || (!isChannelMuted(member) && messages > 0),
        messages,
        mentions,
        hasUrgent,
    };
}
