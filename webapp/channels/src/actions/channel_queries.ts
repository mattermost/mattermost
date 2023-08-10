// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {convertRolesNamesArrayToString} from 'mattermost-redux/actions/roles';

import type {ChannelMembership, ServerChannel, ChannelType} from '@mattermost/types/channels';
import type {Role} from '@mattermost/types/roles';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

export const CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE = 200;

type Cursor = {
    cursor: string;
}

export type GraphQLChannel = Omit<ServerChannel, 'team_id'> & Cursor & {
    team: Team;
};

export type GraphQLChannelMember = Omit<ChannelMembership, 'channel_id | user_id | roles | post_root_id'> & Cursor & {
    channel: ServerChannel;
    roles: Role[];
};

export type ChannelsAndChannelMembersQueryResponseType = {
    data?: {
        channels: GraphQLChannel[];
        channelMembers: GraphQLChannelMember[];
    };
    errors?: unknown;
}

const channelsFragment = `
    fragment channelsFragment on Channel {
        cursor
        id
        create_at: createAt
        update_at: updateAt
        delete_at: deleteAt
        team {
          id
        }
        type
        display_name: displayName
        name
        header
        purpose
        last_post_at: lastPostAt
        last_root_post_at: lastRootPostAt
        total_msg_count: totalMsgCount
        total_msg_count_root: totalMsgCountRoot
        creator_id: creatorId
        scheme_id: schemeId
        group_constrained: groupConstrained
        shared
        props
        policy_id: policyId
    }
`;

const channelMembersFragment = `
    fragment channelMembersFragment on ChannelMember {
        cursor
        channel {
            id
        }
        roles {
            id
            name
            permissions
        }
        last_viewed_at: lastViewedAt
        msg_count: msgCount
        msg_count_root: msgCountRoot
        mention_count: mentionCount
        mention_count_root: mentionCountRoot
        urgent_mention_count: urgentMentionCount
        notify_props: notifyProps
        last_update_at: lastUpdateAt
        scheme_admin: schemeAdmin
        scheme_user: schemeUser
    }
`;

const channelsAndChannelMembersQueryString = `
    query gqlWebChannelsAndChannelMembers($teamId: String, $perPage: Int!, $channelsCursor: String, $channelMembersCursor: String) {
        channels(userId: "me", teamId: $teamId, first: $perPage, after: $channelsCursor) {
            ...channelsFragment
        }
        channelMembers(userId: "me", teamId: $teamId, first: $perPage, after: $channelMembersCursor) {
            ...channelMembersFragment
        }
    }

    ${channelsFragment}
    ${channelMembersFragment}
`;

export function getChannelsAndChannelMembersQueryString(teamId: Team['id'] = '', channelsCursor: Cursor['cursor'] = '', channelMembersCursor: Cursor['cursor'] = '') {
    return JSON.stringify({
        query: channelsAndChannelMembersQueryString,
        operationName: 'gqlWebChannelsAndChannelMembers',
        variables: {
            teamId,
            perPage: CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE,
            channelsCursor,
            channelMembersCursor,
        },
    });
}

export function transformToReceivedChannelsReducerPayload(
    channels: Partial<GraphQLChannel[]>,
): ServerChannel[] {
    return channels.map((channel) => ({
        id: channel?.id ?? '',
        create_at: channel?.create_at ?? 0,
        update_at: channel?.update_at ?? 0,
        delete_at: channel?.delete_at ?? 0,
        team_id: channel?.team?.id ?? '',
        type: channel?.type ?? '' as ChannelType,
        display_name: channel?.display_name ?? '',
        name: channel?.name ?? '',
        header: channel?.header ?? '',
        purpose: channel?.purpose ?? '',
        last_post_at: channel?.last_post_at ?? 0,
        last_root_post_at: channel?.last_root_post_at ?? 0,
        total_msg_count: channel?.total_msg_count ?? 0,
        total_msg_count_root: channel?.total_msg_count_root ?? 0,
        creator_id: channel?.creator_id ?? '',
        scheme_id: channel?.scheme_id ?? '',
        group_constrained: channel?.group_constrained ?? false,
        shared: channel?.shared ?? undefined,
        props: channel && channel.props ? {...channel.props} : undefined,
        policy_id: channel?.policy_id ?? null,
    }));
}

export function transformToReceivedChannelMembersReducerPayload(
    channelMembers: Partial<GraphQLChannelMember[]>,
    userId: UserProfile['id'],
): ChannelMembership[] {
    return channelMembers.map((channelMember) => ({
        channel_id: channelMember?.channel?.id ?? '',
        user_id: userId,
        roles: convertRolesNamesArrayToString(channelMember?.roles ?? []),
        last_viewed_at: channelMember?.last_viewed_at ?? 0,
        msg_count: channelMember?.msg_count ?? 0,
        msg_count_root: channelMember?.msg_count_root ?? 0,
        mention_count: channelMember?.mention_count ?? 0,
        mention_count_root: channelMember?.mention_count_root ?? 0,
        urgent_mention_count: channelMember?.urgent_mention_count ?? 0,
        notify_props: channelMember && channelMember.notify_props ? {...channelMember.notify_props} : {},
        last_update_at: channelMember?.last_update_at ?? 0,
        scheme_admin: channelMember?.scheme_admin ?? false,
        scheme_user: channelMember?.scheme_user ?? false,
    }));
}
