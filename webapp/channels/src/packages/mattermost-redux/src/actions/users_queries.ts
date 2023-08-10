// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {convertRolesNamesArrayToString} from 'mattermost-redux/actions/roles';

import type {ClientConfig, ClientLicense} from '@mattermost/types/config';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {Role} from '@mattermost/types/roles';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

const currentUserInfoQueryString = `
    query gqlWebCurrentUserInfo {
        config
        license
        user(id: "me") {
            id
            create_at: createAt
            delete_at: deleteAt
            update_at: updateAt
            username
            auth_service: authService
            email
            nickname
            first_name: firstName
            last_name: lastName
            position
            roles {
                id
                name
                permissions
            }
            props
            notify_props: notifyProps
            last_picture_update: lastPictureUpdate
            last_password_update: lastPasswordUpdate
            terms_of_service_id: termsOfServiceId
            terms_of_service_create_at: termsOfServiceCreateAt
            locale
            timezone
            remote_id: remoteId
            preferences {
                name
                user_id: userId
                category
                value
            }
            is_bot: isBot
            bot_description: botDescription
            mfa_active: mfaActive
        }
        teamMembers(userId: "me") {
            team {
                id
                display_name: displayName
                name
                create_at: createAt
                update_at: updateAt
                delete_at: deleteAt
                description
                email
                type
                company_name: companyName
                allowed_domains: allowedDomains
                invite_id: inviteId
                last_team_icon_update: lastTeamIconUpdate
                group_constrained: groupConstrained
                allow_open_invite: allowOpenInvite
                scheme_id: schemeId
                policy_id: policyId
            }
            roles {
                id
                name
                permissions
            }
            delete_at: deleteAt
            scheme_guest: schemeGuest
            scheme_user: schemeUser
            scheme_admin: schemeAdmin
        }
    }
`;

export const currentUserInfoQuery = JSON.stringify({query: currentUserInfoQueryString, operationName: 'gqlWebCurrentUserInfo'});

type GraphQLUser = UserProfile & {
    roles: Role[];
    preferences: PreferenceType[];
};

type GraphQLTeamMember = {
    team: Team;
    user: UserProfile;
    roles: Role[];
    delete_at: number;
    scheme_guest: boolean;
    scheme_user: boolean;
    scheme_admin: boolean;
}

export type CurrentUserInfoQueryResponseType = {
    data?: {
        user: GraphQLUser;
        config: ClientConfig;
        license: ClientLicense;
        teamMembers: GraphQLTeamMember[];
    };
    errors?: unknown;
};

export function transformToReceivedUserAndTeamRolesReducerPayload(
    userRoles: GraphQLUser['roles'],
    teamMembers: GraphQLTeamMember[]): Role[] {
    let roles: Role[] = [...userRoles];

    teamMembers.forEach((teamMember) => {
        if (teamMember.roles) {
            roles = [...roles, ...teamMember.roles];
        }
    });

    return roles;
}

export function transformToRecievedMeReducerPayload(user: GraphQLUser): UserProfile {
    return {
        ...user,
        position: user?.position ?? '',
        roles: convertRolesNamesArrayToString(user?.roles ?? []),
    };
}

export function transformToRecievedTeamsListReducerPayload(teamsMembers: GraphQLTeamMember[]): Team[] {
    return teamsMembers.map((teamMember) => ({...teamMember.team}));
}

export function transformToRecievedMyTeamMembersReducerPayload(
    teamsMembers: Partial<GraphQLTeamMember[]>,
    userId: UserProfile['id'],
): TeamMembership[] {
    return teamsMembers.map((teamMember) => ({
        team_id: teamMember?.team?.id ?? '',
        user_id: userId || '',
        delete_at: teamMember?.delete_at ?? 0,
        roles: convertRolesNamesArrayToString(teamMember?.roles ?? []),
        scheme_admin: teamMember?.scheme_admin ?? false,
        scheme_guest: teamMember?.scheme_guest ?? false,
        scheme_user: teamMember?.scheme_user ?? false,

        // Remove these fields once webapp deprecates getting unread counts from teams
        // below fields arent included in the response but were inside of TeamMembership api types
        mention_count: 0,
        mention_count_root: 0,
        msg_count: 0,
        msg_count_root: 0,
        thread_count: 0,
        thread_mention_count: 0,
    }));
}
