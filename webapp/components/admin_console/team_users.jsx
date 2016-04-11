// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AdminStore from 'stores/admin_store.jsx';
import Client from 'utils/web_client.jsx';
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

        this.state = {
            team: AdminStore.getTeam(this.props.params.team),
            users: null,
            serverError: null,
            showPasswordModal: false,
            user: null
        };
    }

    componentDidMount() {
        this.getCurrentTeamProfiles();
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
                    users: memberList,
                    serverError: this.state.serverError,
                    showPasswordModal: this.state.showPasswordModal,
                    user: this.state.user
                });
            },
            (err) => {
                this.setState({
                    users: null,
                    serverError: err.message,
                    showPasswordModal: this.state.showPasswordModal,
                    user: this.state.user
                });
            }
        );
    }

    doPasswordReset(user) {
        this.setState({
            users: this.state.users,
            serverError: this.state.serverError,
            showPasswordModal: true,
            user
        });
    }

    doPasswordResetDismiss() {
        this.setState({
            users: this.state.users,
            serverError: this.state.serverError,
            showPasswordModal: false,
            user: null
        });
    }

    doPasswordResetSubmit() {
        this.setState({
            users: this.state.users,
            serverError: this.state.serverError,
            showPasswordModal: false,
            user: null
        });
    }

    componentWillReceiveProps(nextProps) {
        this.getTeamProfiles(nextProps.params.team);

        if (nextProps.params.team !== this.props.params.team) {
            this.setState({
                team: AdminStore.getTeam(nextProps.params.team)
            });
        }
    }

    render() {
        if (!this.state.team) {
            return null;
        }

        if (this.state.users == null) {
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
            return (
                <UserItem
                    key={'user_' + user.id}
                    user={user}
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
