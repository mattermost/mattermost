// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';

import * as TeamActions from 'actions/team_actions.jsx';

import {Client4} from 'mattermost-redux/client';

import LoadingScreen from 'components/loading_screen.jsx';

import {sortTeamsByDisplayName} from 'utils/team_utils.jsx';
import * as Utils from 'utils/utils.jsx';

import ManageTeamsDropdown from './manage_teams_dropdown.jsx';
import RemoveFromTeamButton from './remove_from_team_button.jsx';

export default class ManageTeamsModal extends React.Component {
    static propTypes = {
        onModalDismissed: PropTypes.func.isRequired,
        show: PropTypes.bool.isRequired,
        user: PropTypes.object
    };

    constructor(props) {
        super(props);

        this.state = {
            error: null,
            teams: null,
            teamMembers: null
        };
    }

    componentDidMount() {
        if (this.props.user) {
            this.loadTeamsAndTeamMembers();
        }
    }

    componentWillReceiveProps(nextProps) {
        const userId = this.props.user ? this.props.user.id : '';
        const nextUserId = nextProps.user ? nextProps.user.id : '';

        if (userId !== nextUserId) {
            this.setState({
                teams: null,
                teamMembers: null
            });

            if (nextProps.user) {
                this.loadTeamsAndTeamMembers(nextProps.user);
            }
        }
    }

    loadTeamsAndTeamMembers = (user = this.props.user) => {
        TeamActions.getTeamsForUser(user.id, (teams) => {
            this.setState({
                teams: teams.sort(sortTeamsByDisplayName)
            });
        });

        TeamActions.getTeamMembersForUser(user.id, (teamMembers) => {
            this.setState({
                teamMembers
            });
        });
    }

    handleError = (error) => {
        this.setState({
            error
        });
    }

    handleMemberChange = () => {
        TeamActions.getTeamMembersForUser(this.props.user.id, (teamMembers) => {
            this.setState({
                teamMembers
            });
        });
    }

    handleMemberRemove = (teamId) => {
        this.setState({
            teams: this.state.teams.filter((team) => team.id !== teamId),
            teamMembers: this.state.teamMembers.filter((teamMember) => teamMember.team_id !== teamId)
        });
    }

    renderContents = () => {
        const {user} = this.props;
        const {teams, teamMembers} = this.state;

        if (!user) {
            return <LoadingScreen/>;
        }

        const isSystemAdmin = Utils.isAdmin(user.roles);

        let name = Utils.getFullName(user);
        if (name) {
            name += ` (@${user.username})`;
        } else {
            name = `@${user.username}`;
        }

        let teamList;
        if (teams && teamMembers) {
            teamList = teams.map((team) => {
                const teamMember = teamMembers.find((member) => member.team_id === team.id);
                if (!teamMember) {
                    return null;
                }

                let action;
                if (isSystemAdmin) {
                    action = (
                        <RemoveFromTeamButton
                            user={user}
                            team={team}
                            onError={this.handleError}
                            onMemberRemove={this.handleMemberRemove}
                        />
                    );
                } else {
                    action = (
                        <ManageTeamsDropdown
                            user={user}
                            team={team}
                            teamMember={teamMember}
                            onError={this.handleError}
                            onMemberChange={this.handleMemberChange}
                            onMemberRemove={this.handleMemberRemove}
                        />
                    );
                }

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
                    <img
                        className='manage-teams__profile-picture'
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
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
    }

    render() {
        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onModalDismissed}
                dialogClassName='manage-teams'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='admin.user_item.manageTeams'
                            defaultMessage='Manage Teams'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.renderContents()}
                </Modal.Body>
            </Modal>
        );
    }
}
