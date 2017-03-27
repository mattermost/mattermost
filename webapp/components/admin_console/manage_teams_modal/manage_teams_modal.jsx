// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import * as TeamActions from 'actions/team_actions.jsx';

import Client from 'client/web_client.jsx';

import LoadingScreen from 'components/loading_screen.jsx';

import * as Utils from 'utils/utils.jsx';

import ManageTeamsDropdown from './manage_teams_dropdown.jsx';

export default class ManageTeamsModal extends React.Component {
    static propTypes = {
        onModalDismissed: React.PropTypes.func.isRequired,
        show: React.PropTypes.bool.isRequired,
        user: React.PropTypes.object
    };

    constructor(props) {
        super(props);

        this.loadTeamsAndTeamMembers = this.loadTeamsAndTeamMembers.bind(this);

        this.handleError = this.handleError.bind(this);
        this.handleMemberChange = this.handleMemberChange.bind(this);
        this.handleMemberRemove = this.handleMemberRemove.bind(this);

        this.renderContents = this.renderContents.bind(this);

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

    loadTeamsAndTeamMembers(user = this.props.user) {
        TeamActions.getTeamsForUser(user.id, (teams) => {
            this.setState({
                teams
            });
        });

        TeamActions.getTeamMembersForUser(user.id, (teamMembers) => {
            this.setState({
                teamMembers
            });
        });
    }

    handleError(error) {
        this.setState({
            error
        });
    }

    handleMemberChange() {
        TeamActions.getTeamMembersForUser(this.props.user.id, (teamMembers) => {
            this.setState({
                teamMembers
            });
        });
    }

    handleMemberRemove(teamId) {
        this.setState({
            teams: this.state.teams.filter((team) => team.id !== teamId),
            teamMembers: this.state.teamMembers.filter((teamMember) => teamMember.team_id !== teamId)
        });
    }

    renderContents() {
        const {user} = this.props;
        const {teams, teamMembers} = this.state;

        if (!user) {
            return <LoadingScreen/>;
        }

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

                return (
                    <div
                        key={team.id}
                        className='manage-teams__team'
                    >
                        <div className='manage-teams__team-name'>
                            {team.display_name}
                        </div>
                        <div className='manage-teams__team-actions'>
                            <ManageTeamsDropdown
                                user={user}
                                team={team}
                                teamMember={teamMember}
                                onError={this.handleError}
                                onMemberChange={this.handleMemberChange}
                                onMemberRemove={this.handleMemberRemove}
                            />
                        </div>
                    </div>
                );
            });
        } else {
            teamList = <LoadingScreen/>;
        }

        return (
            <div>
                <div className='manage-teams__user'>
                    <img
                        className='manage-teams__profile-picture'
                        src={Client.getProfilePictureUrl(user.id, user.last_picture_update)}
                    />
                    <div className='manage-teams__info'>
                        <div className='manage-teams__name'>
                            {name}
                        </div>
                        <div className='manage-teams__email'>
                            {user.email}
                        </div>
                    </div>
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
                        {'Manage Teams'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.renderContents()}
                </Modal.Body>
            </Modal>
        );
    }
}
