// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import EllipsisHorizontalIcon from 'components/widgets/icons/ellipsis_h_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import type {TeamWithMembership} from './types';

type Props = {
    team: TeamWithMembership;
    doRemoveUserFromTeam: (teamId: string) => void;
    doMakeUserTeamAdmin: (teamId: string) => void;
    doMakeUserTeamMember: (teamId: string) => void;
    isDisabled?: boolean;
}

const TeamListDropdown = ({
    team,
    doRemoveUserFromTeam,
    doMakeUserTeamAdmin,
    doMakeUserTeamMember,
    isDisabled,
}: Props) => {
    const intl = useIntl();

    const isAdmin = team.scheme_admin;
    const isMember = team.scheme_user && !team.scheme_admin;
    const isGuest = team.scheme_guest;
    const showMakeTeamAdmin = !isAdmin && !isGuest;
    const showMakeTeamMember = !isMember && !isGuest;

    const makeTeamAdminOnClick = useCallback(() => doMakeUserTeamAdmin(team.id), [team.id, doMakeUserTeamAdmin]);
    const makeTeamMemberOnClick = useCallback(() => doMakeUserTeamMember(team.id), [team.id, doMakeUserTeamMember]);
    const removeUserTeamOnClick = useCallback(() => doRemoveUserFromTeam(team.id), [team.id, doRemoveUserFromTeam]);

    return (
        <MenuWrapper isDisabled={isDisabled}>
            <button
                type='button'
                id={`teamListDropdown_${team.id}`}
                className='dropdown-toggle theme color--link style--none'
                aria-expanded='true'
            >
                <span className='SystemUserDetail__actions-menu-icon'><EllipsisHorizontalIcon/></span>
            </button>
            <div>
                <Menu
                    openLeft={true}
                    openUp={false}
                    ariaLabel={intl.formatMessage({id: 'team_members_dropdown.menuAriaLabel', defaultMessage: 'Change the role of a team member'})}
                >
                    <Menu.ItemAction
                        id='makeTeamAdmin'
                        show={showMakeTeamAdmin}
                        onClick={makeTeamAdminOnClick}
                        text={intl.formatMessage({id: 'team_members_dropdown.makeAdmin', defaultMessage: 'Make Team Admin'})}
                    />
                    <Menu.ItemAction
                        show={showMakeTeamMember}
                        onClick={makeTeamMemberOnClick}
                        text={intl.formatMessage({id: 'team_members_dropdown.makeMember', defaultMessage: 'Make Team Member'})}
                    />
                    <Menu.ItemAction
                        id='removeFromTeam'
                        show={true}
                        onClick={removeUserTeamOnClick}
                        text={intl.formatMessage({id: 'team_members_dropdown.leave_team', defaultMessage: 'Remove from Team'})}
                        buttonClass='SystemUserDetail__action-remove-team'
                    />
                </Menu>
            </div>
        </MenuWrapper>
    );
};

export default memo(TeamListDropdown);
