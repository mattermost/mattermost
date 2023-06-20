// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {UserProfile} from '@mattermost/types/users';
import {TeamMembership} from '@mattermost/types/teams';
import {ChannelMembership} from '@mattermost/types/channels';
import {Group} from '@mattermost/types/groups';

type ProfileWithGroups = Partial<UserProfile & {
    groups: Array<Partial<Group>>;
}>;

interface GroupUsersRoleProps {
    user: ProfileWithGroups;
    membership: TeamMembership | ChannelMembership;
    scope: 'team' | 'channel';
}

export default function UsersToRemoveRole(props: GroupUsersRoleProps) {
    const intl = useIntl();
    const {user, membership, scope} = props;

    let role = 'guest';
    if (user.roles?.includes('system_admin')) {
        role = 'system_admin';
    } else if (membership) {
        if (scope === 'team') {
            if (membership.scheme_admin) {
                role = 'team_admin';
            } else if (membership.scheme_user) {
                role = 'team_user';
            }
        }

        if (scope === 'channel') {
            if (membership.scheme_admin) {
                role = 'channel_admin';
            } else if (membership.scheme_user) {
                role = 'channel_user';
            }
        }
    }

    let localizedRole;
    switch (role) {
    case 'system_admin':
        localizedRole = intl.formatMessage({id: 'admin.user_grid.system_admin', defaultMessage: 'System Admin'});
        break;

    case 'team_admin':
        localizedRole = intl.formatMessage({id: 'admin.user_grid.team_admin', defaultMessage: 'Team Admin'});
        break;

    case 'channel_admin':
        localizedRole = intl.formatMessage({id: 'admin.user_grid.channel_admin', defaultMessage: 'Channel Admin'});
        break;

    case 'team_user':
    case 'channel_user':
        localizedRole = intl.formatMessage({id: 'admin.group_teams_and_channels_row.member', defaultMessage: 'Member'});
        break;

    default:
        localizedRole = intl.formatMessage({id: 'admin.user_grid.guest', defaultMessage: 'Guest'});
    }

    return (
        <div className='UsersToRemoveRole'>
            {localizedRole}
        </div>
    );
}
