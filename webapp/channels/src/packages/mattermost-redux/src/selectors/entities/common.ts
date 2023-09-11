// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelMembership, Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne, IDMappedObjects} from '@mattermost/types/utilities';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

const CALLS_PLUGIN = 'plugins-com.mattermost.calls';

type CallsConfig = {
    ICEServers: string[];
    ICEServersConfigs: RTCIceServer[];
    AllowEnableCalls: boolean;
    DefaultEnabled: boolean;
    MaxCallParticipants: number;
    NeedsTURNCredentials: boolean;
    AllowScreenSharing: boolean;
    sku_short_name: string;
}

// Channels

export function getCurrentChannelId(state: GlobalState): string {
    return state.entities.channels.currentChannelId;
}

export function getMyChannelMemberships(state: GlobalState): RelationOneToOne<Channel, ChannelMembership> {
    return state.entities.channels.myMembers;
}

export const getMyCurrentChannelMembership: (a: GlobalState) => ChannelMembership | undefined = createSelector(
    'getMyCurrentChannelMembership',
    getCurrentChannelId,
    getMyChannelMemberships,
    (currentChannelId, channelMemberships) => {
        return channelMemberships[currentChannelId];
    },
);

export function getMembersInChannel(state: GlobalState, channelId: string): Record<string, ChannelMembership> {
    return state.entities.channels?.membersInChannel?.[channelId] || {};
}

// Teams

export function getMembersInTeam(state: GlobalState, teamId: string): RelationOneToOne<UserProfile, TeamMembership> {
    return state.entities.teams?.membersInTeam?.[teamId] || {};
}

// Users

export function getCurrentUser(state: GlobalState): UserProfile {
    return state.entities.users.profiles[getCurrentUserId(state)];
}

export function getCurrentUserEmail(state: GlobalState): UserProfile['email'] {
    return getCurrentUser(state)?.email;
}

export function getCurrentUserId(state: GlobalState): string {
    return state.entities.users.currentUserId;
}

export function getUsers(state: GlobalState): IDMappedObjects<UserProfile> {
    return state.entities.users.profiles;
}

// Calls

export function getCalls(state: GlobalState): Record<string, UserProfile[]> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return state[CALLS_PLUGIN].voiceConnectedProfiles || {};
}

export function getCallsConfig(state: GlobalState): CallsConfig {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return state[CALLS_PLUGIN].callsConfig;
}
