// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AdminStore from 'stores/admin_store.jsx';
import Client from 'client/web_client.jsx';
import FormError from 'components/form_error.jsx';
import LoadingScreen from '../loading_screen.jsx';
import UserItem from './user_item.jsx';
import ResetPasswordModal from './reset_password_modal.jsx';

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class UserList extends React.Component {
    static get propTypes() {
        return {
            params: React.PropTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.onAllTeamsChange = this.onAllTeamsChange.bind(this);

        this.getTeamProfiles = this.getTeamProfiles.bind(this);
        this.getCurrentTeamProfiles = this.getCurrentTeamProfiles.bind(this);
        this.doPasswordReset = this.doPasswordReset.bind(this);
        this.doPasswordResetDismiss = this.doPasswordResetDismiss.bind(this);
        this.doPasswordResetSubmit = this.doPasswordResetSubmit.bind(this);
        this.getTeamMemberForUser = this.getTeamMemberForUser.bind(this);

        this.state = {
            team: AdminStore.getTeam(this.props.params.team),
            users: null,
            teamMembers: null,
            serverError: null,
            showPasswordModal: false,
            user: null
        };
    }

    componentDidMount() {
        this.getCurrentTeamProfiles();

        AdminStore.addAllTeamsChangeListener(this.onAllTeamsChange);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.params.team !== this.props.params.team) {
            this.setState({
                team: AdminStore.getTeam(nextProps.params.team)
            });

            this.getTeamProfiles(nextProps.params.team);
        }
    }

    componentWillUnmount() {
        AdminStore.removeAllTeamsChangeListener(this.onAllTeamsChange);
    }

    onAllTeamsChange() {
        this.setState({
            team: AdminStore.getTeam(this.props.params.team)
        });
    }

    getCurrentTeamProfiles() {
        this.getTeamProfiles(this.props.params.team);
    }

    getTeamProfiles(teamId) {
        Client.getTeamMembers(
            teamId,
            (data) => {
                this.setState({
                    teamMembers: data
                });
            },
            (err) => {
                this.setState({
                    teamMembers: null,
                    serverError: err.message
                });
            }
        );

        Client.getProfilesForTeam(
            teamId,
            (users) => {
                var memberList = [];
                for (var id in users) {
                    if (users.hasOwnProperty(id)) {
                        memberList.push(users[id]);
                    }
                }

                memberList.sort((a, b) => {
                    if (a.username < b.username) {
                        return -1;
                    }

                    if (a.username > b.username) {
                        return 1;
                    }

                    return 0;
                });

                this.setState({
                    users: memberList
                });
            },
            (err) => {
                this.setState({
                    users: null,
                    serverError: err.message
                });
            }
        );
    }

    doPasswordReset(user) {
        this.setState({
            showPasswordModal: true,
            user
        });
    }

    doPasswordResetDismiss() {
        this.setState({
            showPasswordModal: false,
            user: null
        });
    }

    doPasswordResetSubmit() {
        this.getCurrentTeamProfiles();
        this.setState({
            showPasswordModal: false,
            user: null
        });
    }

    getTeamMemberForUser(userId) {
        if (this.state.teamMembers) {
            for (const index in this.state.teamMembers) {
                if (this.state.teamMembers.hasOwnProperty(index)) {
                    var teamMember = this.state.teamMembers[index];

                    if (teamMember.user_id === userId) {
                        return teamMember;
                    }
                }
            }
        }

        return null;
    }

    render() {
        if (!this.state.team) {
            return null;
        }

        if (this.state.users == null || this.state.teamMembers == null) {
            return (
                <div className='wrapper--fixed'>
                    <h3>
                        <FormattedMessage
                            id='admin.userList.title'
                            defaultMessage='Users for {team}'
                            values={{
                                team: this.state.team.name
                            }}
                        />
                    </h3>
                    <FormError error={this.state.serverError}/>
                    <LoadingScreen/>
                </div>
            );
        }

        var memberList = this.state.users.map((user) => {
            var teamMember = this.getTeamMemberForUser(user.id);

            if (!teamMember || teamMember.delete_at > 0) {
                return null;
            }

            return (
                <UserItem
                    team={this.state.team}
                    key={'user_' + user.id}
                    user={user}
                    teamMember={teamMember}
                    refreshProfiles={this.getCurrentTeamProfiles}
                    doPasswordReset={this.doPasswordReset}
                />);
        });

        return (
            <div className='wrapper--fixed'>
                <h3>
                    <FormattedMessage
                        id='admin.userList.title2'
                        defaultMessage='Users for {team} ({count})'
                        values={{
                            team: this.state.team.name,
                            count: this.state.users.length
                        }}
                    />
                </h3>
                <FormError error={this.state.serverError}/>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='more-modal__list member-list-holder'>
                        {memberList}
                    </div>
                </form>
                <ResetPasswordModal
                    user={this.state.user}
                    show={this.state.showPasswordModal}
                    team={this.state.team}
                    onModalSubmit={this.doPasswordResetSubmit}
                    onModalDismissed={this.doPasswordResetDismiss}
                />
            </div>
        );
    }
}
