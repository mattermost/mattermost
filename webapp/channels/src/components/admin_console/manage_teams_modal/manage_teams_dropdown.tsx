// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team, TeamMembership} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ActionResult} from 'mattermost-redux/types/actions';
import {isAdmin, isSystemAdmin, isGuest} from 'mattermost-redux/utils/user_utils';

import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {localizeMessage} from 'utils/utils';

type Props = {
    team: Team;
    user: UserProfile;
    teamMember: TeamMembership;
    onError: (error: JSX.Element) => void;
    onMemberChange: (teamId: string) => void;
    updateTeamMemberSchemeRoles: (teamId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean,) => Promise<ActionResult>;
    handleRemoveUserFromTeam: (teamId: string) => void;
}

const ManageTeamsDropdown = (props: Props) => {
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

    const {team} = props;
    let title;
    if (isSysAdmin) {
        title = localizeMessage('admin.user_item.sysAdmin', 'System Admin');
    } else if (isTeamAdmin) {
        title = localizeMessage('admin.user_item.teamAdmin', 'Team Admin');
    } else if (isGuestUser) {
        title = localizeMessage('admin.user_item.guest', 'Guest');
    } else {
        title = localizeMessage('admin.user_item.teamMember', 'Team Member');
    }

    return (
        <MenuWrapper>
            <a>
                <span>{title} </span>
                <span className='caret'/>
            </a>
            <Menu
                openLeft={true}
                ariaLabel={localizeMessage('team_members_dropdown.menuAriaLabel', 'Change the role of a team member')}
            >
                <Menu.ItemAction
                    show={!isTeamAdmin && !isGuestUser}
                    onClick={makeTeamAdmin}
                    text={localizeMessage('admin.user_item.makeTeamAdmin', 'Make Team Admin')}
                />
                <Menu.ItemAction
                    show={isTeamAdmin}
                    onClick={makeMember}
                    text={localizeMessage('admin.user_item.makeMember', 'Make Team Member')}
                />
                <Menu.ItemAction
                    show={!team.group_constrained}
                    onClick={removeFromTeam}
                    text={localizeMessage('team_members_dropdown.leave_team', 'Remove from Team')}
                />
            </Menu>
        </MenuWrapper>
    );
};

export default ManageTeamsDropdown;
