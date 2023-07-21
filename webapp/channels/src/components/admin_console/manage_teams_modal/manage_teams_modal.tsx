// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team, TeamMembership} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import React, {useEffect} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';
import {ActionResult} from 'mattermost-redux/types/actions';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

import LoadingScreen from 'components/loading_screen';
import Avatar from 'components/widgets/users/avatar';

import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';
import * as Utils from 'utils/utils';

import ManageTeamsDropdown from './manage_teams_dropdown';
import RemoveFromTeamButton from './remove_from_team_button';

export type Props = {
    locale: string;
    onModalDismissed: () => void;
    show: boolean;
    user?: UserProfile;
    actions: {
        getTeamMembersForUser: (userId: string) => Promise<ActionResult>;
        getTeamsForUser: (userId: string) => Promise<ActionResult>;
        updateTeamMemberSchemeRoles: (teamId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => Promise<ActionResult>;
        removeUserFromTeam: (teamId: string, userId: string) => Promise<ActionResult>;
    };
}

const ManageTeamsModal = ({locale, onModalDismissed, show, user, actions}: Props) => {
    const [error, setError] = React.useState<JSX.Element | null>(null);
    const [teams, setTeams] = React.useState<Team[] | null>(null);
    const [teamMembers, setTeamMembers] = React.useState<TeamMembership[] | null>(null);

    useEffect(() => {
        if (user) {
            loadTeamsAndTeamMembers(user);
        }
    }, [user]);

    useEffect(() => {
        if (user?.id) {
            setTeams(null);
            setTeamMembers(null);
        }
    }, [user?.id]);

    const loadTeamsAndTeamMembers = async (user: UserProfile) => {
        await getTeamMembers(user.id);
        const {data} = await actions.getTeamsForUser(user.id);
        setTeams(filterAndSortTeamsByDisplayName(data, locale));
    };

    const handleError = (error: JSX.Element) => setError(error);

    const getTeamMembers = async (userId: string) => {
        const {data} = await actions.getTeamMembersForUser(userId);
        if (data) {
            setTeamMembers(data);
        }
    };

    const handleMemberRemove = (teamId: string) => {
        setTeams(teams!.filter((team) => team.id !== teamId));
        setTeamMembers(teamMembers!.filter((teamMember: TeamMembership) => teamMember.team_id !== teamId));
    };

    const handleRemoveUserFromTeam = async (teamId: string) => {
        const {error} = await actions.removeUserFromTeam(teamId, user ? user.id : '');
        if (error) {
            handleError(
                <FormattedMessage
                    id='admin.manage_teams.removeError'
                    defaultMessage='Unable to remove user from team.'
                />);
        } else {
            handleMemberRemove(teamId);
        }
    };

    const handleMemberChange = () => getTeamMembers(user ? user.id : '');

    const renderContents = () => {
        if (!user) {
            return <LoadingScreen/>;
        }

        const isSystemAdmin = isAdmin(user.roles);

        let name = Utils.getFullName(user);
        if (name) {
            name += ` (@${user.username})`;
        } else {
            name = `@${user.username}`;
        }

        let teamList;
        if (teams && teamMembers) {
            teamList = teams.map((team) => {
                const teamMember = teamMembers.find((member: TeamMembership) => member.team_id === team.id);
                if (!teamMember) {
                    return null;
                }

                const action = isSystemAdmin ? (
                    <RemoveFromTeamButton
                        teamId={team.id}
                        handleRemoveUserFromTeam={handleRemoveUserFromTeam}
                    />
                ) : (
                    <ManageTeamsDropdown
                        user={user}
                        team={team}
                        teamMember={teamMember}
                        onError={handleError}
                        onMemberChange={handleMemberChange}
                        updateTeamMemberSchemeRoles={actions.updateTeamMemberSchemeRoles}
                        handleRemoveUserFromTeam={handleRemoveUserFromTeam}
                    />
                );

                return (
                    <div
                        key={team.id}
                        className='manage-teams__team'
                    >
                        <div className='manage-teams__team-name'>
                            {team.display_name}
                        </div>
                        <div className='manage-teams__team-actions'>
                            {action}
                        </div>
                    </div>
                );
            });
        } else {
            teamList = <LoadingScreen/>;
        }

        let systemAdminIndicator = null;
        if (isSystemAdmin) {
            systemAdminIndicator = (
                <div className='manage-teams__system-admin'>
                    <FormattedMessage
                        id='admin.user_item.sysAdmin'
                        defaultMessage='System Admin'
                    />
                </div>
            );
        }

        return (
            <div>
                <div className='manage-teams__user'>
                    <Avatar
                        username={user.username}
                        url={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        size='lg'
                    />
                    <div className='manage-teams__info'>
                        <div className='manage-teams__name'>
                            {name}
                        </div>
                        <div className='manage-teams__email'>
                            {user.email}
                        </div>
                    </div>
                    {systemAdminIndicator}
                </div>
                <div className='manage-teams__teams'>
                    {teamList}
                </div>
            </div>
        );
    };

    return (
        <Modal
            show={show}
            onHide={onModalDismissed}
            dialogClassName='a11y__modal manage-teams modal--overflow-visible'
            role='dialog'
            aria-labelledby='manageTeamsModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='manageTeamsModalLabel'
                >
                    <FormattedMessage
                        id='admin.user_item.manageTeams'
                        defaultMessage='Manage Teams'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {renderContents()}
                {error}
            </Modal.Body>
        </Modal>
    );
};

export default ManageTeamsModal;
