// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {autocompleteUsers} from 'mattermost-redux/actions/users';
import {getAssociatedGroupsForReferenceByMention} from 'mattermost-redux/selectors/entities/groups';
import {
    getUserIdsInChannels,
    getUserIdsInTeams,
    getUserIdsNotInChannels,
    getUsersByUsername,
} from 'mattermost-redux/selectors/entities/users';

import {canManageMembers, isMembershipPolicyEnforced} from 'utils/channel_utils';
import Constants from 'utils/constants';
import {groupsMentionedInText} from 'utils/post_utils';

import type {DispatchFunc, GlobalState} from 'types/store';

export type OutOfChannelMentionResult = {
    addable: UserProfile[];
    notAddable: UserProfile[];
    outOfTeam: UserProfile[];
};

export function extractUserMentionsFromMessage(message: string): string[] {
    const regex = new RegExp(Constants.MENTIONS_REGEX.source, 'gi');
    const mentions = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(message)) !== null) {
        const username = match[1];
        if (!Constants.SPECIAL_MENTIONS.includes(username.toLowerCase())) {
            mentions.add(username);
        }
    }
    return Array.from(mentions);
}

function getGroupMentionNamesInMessage(state: GlobalState, channel: Channel, message: string): Set<string> {
    const groups = getAssociatedGroupsForReferenceByMention(state, channel.team_id, channel.id);
    const names = new Set<string>();
    groupsMentionedInText(message, groups).forEach((g) => names.add(g.name.toLowerCase()));
    return names;
}

function isUserInChannel(state: GlobalState, channelId: string, userId: string): boolean {
    return Boolean(getUserIdsInChannels(state)[channelId]?.has(userId));
}

function isUserNotInChannelCached(state: GlobalState, channelId: string, userId: string): boolean {
    return Boolean(getUserIdsNotInChannels(state)[channelId]?.has(userId));
}

function isUserDefinitelyNotOnTeam(state: GlobalState, teamId: string, userId: string): boolean {
    const teamMembers = getUserIdsInTeams(state)[teamId];
    if (!teamMembers || teamMembers.size === 0) {
        return false;
    }
    return !teamMembers.has(userId);
}

function findUserByUsername(users: UserProfile[], username: string): UserProfile | undefined {
    const lower = username.toLowerCase();
    return users.find((u) => u.username.toLowerCase() === lower);
}

export async function getOutOfChannelMentionsFromMessage(
    state: GlobalState,
    dispatch: DispatchFunc,
    channel: Channel,
    message: string,
): Promise<OutOfChannelMentionResult | null> {
    if (!canManageMembers(state, channel)) {
        return null;
    }

    if (channel.type !== Constants.OPEN_CHANNEL && channel.type !== Constants.PRIVATE_CHANNEL) {
        return null;
    }

    const groupNames = getGroupMentionNamesInMessage(state, channel, message);
    const usernames = extractUserMentionsFromMessage(message).filter(
        (username) => !groupNames.has(username.toLowerCase()),
    );

    if (usernames.length === 0) {
        return null;
    }

    const usersByUsername = getUsersByUsername(state);
    const addable: UserProfile[] = [];
    const notAddable: UserProfile[] = [];
    const outOfTeam: UserProfile[] = [];
    const seen = new Set<string>();
    const policyEnforced = isMembershipPolicyEnforced(channel);

    const addOutOfChannelTeamMember = (user: UserProfile) => {
        if (seen.has(user.id)) {
            return;
        }
        seen.add(user.id);

        if (policyEnforced) {
            notAddable.push(user);
            return;
        }

        addable.push(user);
    };

    const addOutOfTeamUser = (user: UserProfile) => {
        if (seen.has(user.id)) {
            return;
        }
        seen.add(user.id);
        outOfTeam.push(user);
    };

    for (const username of usernames) {
        const cachedUser = usersByUsername[username.toLowerCase()] || usersByUsername[username];

        if (cachedUser && isUserInChannel(state, channel.id, cachedUser.id)) {
            continue;
        }

        if (cachedUser && isUserNotInChannelCached(state, channel.id, cachedUser.id)) {
            addOutOfChannelTeamMember(cachedUser);
            continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const result = await dispatch(autocompleteUsers(username, channel.team_id, channel.id));
        if (result.error || !result.data) {
            continue;
        }

        const inChannel = findUserByUsername(result.data.users || [], username);
        if (inChannel) {
            continue;
        }

        const outOfChannel = findUserByUsername(result.data.out_of_channel || [], username);
        if (outOfChannel) {
            addOutOfChannelTeamMember(outOfChannel);
            continue;
        }

        if (cachedUser && isUserDefinitelyNotOnTeam(state, channel.team_id, cachedUser.id)) {
            addOutOfTeamUser(cachedUser);
        }
    }

    if (addable.length === 0) {
        return null;
    }

    return {addable, notAddable, outOfTeam};
}
