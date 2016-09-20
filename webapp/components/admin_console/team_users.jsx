// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from 'components/searchable_user_list.jsx';
import AdminTeamMembersDropdown from './admin_team_members_dropdown.jsx';
import LoadingScreen from 'components/loading_screen.jsx';
import ResetPasswordModal from './reset_password_modal.jsx';
import FormError from 'components/form_error.jsx';

import AdminStore from 'stores/admin_store.jsx';

import Client from 'client/web_client.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const USERS_PER_PAGE = 50;

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
        this.nextPage = this.nextPage.bind(this);

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
            0,
            Constants.PROFILE_CHUNK_SIZE,
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

    nextPage(page) {
        Client.getProfilesForTeam(
            this.props.params.team,
            (page + 1) * USERS_PER_PAGE,
            Constants.PROFILE_CHUNK_SIZE,
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

                const newUsers = this.state.users.concat(memberList);

                this.setState({
                    users: newUsers
                });
            },
            (err) => {
                this.setState({
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

        const teamMembers = this.state.teamMembers;
        const actionUserProps = {};
        for (let i = 0; i < teamMembers.length; i++) {
            actionUserProps[teamMembers[i].user_id] = {
                teamMember: teamMembers[i]
            };
        }

        const mfaEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MFA === 'true' && global.window.mm_config.EnableMultifactorAuthentication === 'true';

        const users = this.state.users;
        const extraInfo = {};
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const info = [];

            if (user.auth_service) {
                const service = (user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) ? user.auth_service.toUpperCase() : Utils.toTitleCase(user.auth_service);
                info.push(
                    <FormattedHTMLMessage
                        id='admin.user_item.authServiceNotEmail'
                        defaultMessage='<strong>Sign-in Method:</strong> {service}'
                        values={{
                            service
                        }}
                    />
                );
            } else {
                info.push(
                    <FormattedHTMLMessage
                        id='admin.user_item.authServiceEmail'
                        defaultMessage='<strong>Sign-in Method:</strong> Email'
                    />
                );
            }

            if (mfaEnabled) {
                if (user.mfa_active) {
                    info.push(
                        <FormattedHTMLMessage
                            id='admin.user_item.mfaYes'
                            defaultMessage='<strong>MFA</strong>: Yes'
                        />
                    );
                } else {
                    info.push(
                        <FormattedHTMLMessage
                            id='admin.user_item.mfaNo'
                            defaultMessage='<strong>MFA</strong>: No'
                        />
                    );
                }
            }

            extraInfo[user.id] = info;
        }

        return (
            <div className='wrapper--fixed'>
                <h3>
                    <FormattedMessage
                        id='admin.userList.title2'
                        defaultMessage='Users for {team} ({count})'
                        values={{
                            team: this.state.team.name,
                            count: this.state.teamMembers.length
                        }}
                    />
                </h3>
                <FormError error={this.state.serverError}/>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='more-modal__list member-list-holder'>
                        <SearchableUserList
                            users={this.state.users}
                            usersPerPage={USERS_PER_PAGE}
                            extraInfo={extraInfo}
                            nextPage={this.nextPage}
                            actions={[AdminTeamMembersDropdown]}
                            actionProps={{
                                refreshProfiles: this.getCurrentTeamProfiles,
                                doPasswordReset: this.doPasswordReset
                            }}
                            actionUserProps={actionUserProps}
                        />
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
