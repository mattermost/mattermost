// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {isAdmin, isSystemAdmin, isGuest} from 'mattermost-redux/utils/user_utils';

import * as Menu from 'components/menu';
import DropdownIcon from 'components/widgets/icons/fa_dropdown_icon';

const ROWS_FROM_BOTTOM_TO_OPEN_UP = 3;

// The role dropdown opens upward for rows near the bottom of the list so its menu
// stays inside the modal instead of overflowing below it (MM-69226).
export function shouldOpenUp(index: number, totalTeams: number): boolean {
    return totalTeams > ROWS_FROM_BOTTOM_TO_OPEN_UP && totalTeams - index <= ROWS_FROM_BOTTOM_TO_OPEN_UP;
}

type Props = {
    team: Team;
    user: UserProfile;
    teamMember: TeamMembership;
    index: number;
    totalTeams: number;
    onError: (error: JSX.Element) => void;
    onMemberChange: (teamId: string) => void;
    updateTeamMemberSchemeRoles: (teamId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => Promise<ActionResult>;
    handleRemoveUserFromTeam: (teamId: string) => void;
};

const ManageTeamsDropdown = (props: Props) => {
    const {formatMessage} = useIntl();

    const makeTeamAdmin = async () => {
        const {error} = await props.updateTeamMemberSchemeRoles(props.teamMember.team_id, props.user.id, true, true);
        if (error) {
            props.onError(
                <FormattedMessage
                    id='admin.manage_teams.makeAdminError'
                    defaultMessage='Unable to make user a team admin.'
                />);
        } else {
            props.onMemberChange(props.teamMember.team_id);
        }
    };

    const makeMember = async () => {
        const {error} = await props.updateTeamMemberSchemeRoles(props.teamMember.team_id, props.user.id, true, false);
        if (error) {
            props.onError(
                <FormattedMessage
                    id='admin.manage_teams.makeMemberError'
                    defaultMessage='Unable to make user a member.'
                />,
            );
        } else {
            props.onMemberChange(props.teamMember.team_id);
        }
    };

    const removeFromTeam = () => props.handleRemoveUserFromTeam(props.teamMember.team_id);

    const isTeamAdmin = isAdmin(props.teamMember.roles) || props.teamMember.scheme_admin;
    const isSysAdmin = isSystemAdmin(props.user.roles);
    const isGuestUser = isGuest(props.user.roles);

    const {team, index, totalTeams} = props;

    const openUp = shouldOpenUp(index, totalTeams);

    let title;
    if (isSysAdmin) {
        title = formatMessage({id: 'admin.user_item.sysAdmin', defaultMessage: 'System Admin'});
    } else if (isTeamAdmin) {
        title = formatMessage({id: 'admin.user_item.teamAdmin', defaultMessage: 'Team Admin'});
    } else if (isGuestUser) {
        title = formatMessage({id: 'admin.user_item.guest', defaultMessage: 'Guest'});
    } else {
        title = formatMessage({id: 'admin.user_item.teamMember', defaultMessage: 'Team Member'});
    }

    const showMakeTeamAdmin = !isTeamAdmin && !isGuestUser;
    const showRemoveFromTeam = !team.group_constrained;

    return (
        <Menu.Container
            menuButton={{
                id: `manageTeamsDropdown_${team.id}`,
                class: 'dropdown-toggle theme color--link style--none',
                children: (
                    <>
                        <span>{title} </span>
                        <DropdownIcon/>
                    </>
                ),
            }}
            menu={{
                id: `manageTeamsDropdown_${team.id}_menu`,
                'aria-label': formatMessage({id: 'team_members_dropdown.menuAriaLabel', defaultMessage: 'Change the role of a team member'}),
            }}
            anchorOrigin={{
                vertical: openUp ? 'top' : 'bottom',
                horizontal: 'right',
            }}
            transformOrigin={{
                vertical: openUp ? 'bottom' : 'top',
                horizontal: 'right',
            }}
        >
            {showMakeTeamAdmin ? (
                <Menu.Item
                    id='makeTeamAdmin'
                    onClick={makeTeamAdmin}
                    labels={
                        <FormattedMessage
                            id='admin.user_item.makeTeamAdmin'
                            defaultMessage='Make Team Admin'
                        />
                    }
                />
            ) : null}
            {isTeamAdmin ? (
                <Menu.Item
                    id='makeTeamMember'
                    onClick={makeMember}
                    labels={
                        <FormattedMessage
                            id='admin.user_item.makeMember'
                            defaultMessage='Make Team Member'
                        />
                    }
                />
            ) : null}
            {showRemoveFromTeam ? (
                <Menu.Item
                    id='removeFromTeam'
                    onClick={removeFromTeam}
                    labels={
                        <FormattedMessage
                            id='team_members_dropdown.leave_team'
                            defaultMessage='Remove from Team'
                        />
                    }
                />
            ) : null}
        </Menu.Container>
    );
};

export default ManageTeamsDropdown;
