// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container.jsx';
import AdminTeamMembersDropdown from './admin_team_members_dropdown.jsx';
import ResetPasswordModal from './reset_password_modal.jsx';
import FormError from 'components/form_error.jsx';

import AdminStore from 'stores/admin_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {searchUsers, loadProfilesAndTeamMembers, loadTeamMembersForProfilesList} from 'actions/user_actions.jsx';
import {getTeamStats, getUser} from 'utils/async_client.jsx';

import {Constants, UserSearchOptions} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
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
        this.onStatsChange = this.onStatsChange.bind(this);
        this.onUsersChange = this.onUsersChange.bind(this);
        this.onTeamChange = this.onTeamChange.bind(this);

        this.doPasswordReset = this.doPasswordReset.bind(this);
        this.doPasswordResetDismiss = this.doPasswordResetDismiss.bind(this);
        this.doPasswordResetSubmit = this.doPasswordResetSubmit.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.search = this.search.bind(this);
        this.loadComplete = this.loadComplete.bind(this);

        this.searchTimeoutId = 0;

        const stats = TeamStore.getStats(this.props.params.team);

        this.state = {
            team: AdminStore.getTeam(this.props.params.team),
            users: [],
            teamMembers: TeamStore.getMembersInTeam(this.props.params.team),
            total: stats.total_member_count,
            serverError: null,
            showPasswordModal: false,
            loading: true,
            user: null
        };
    }

    componentDidMount() {
        AdminStore.addAllTeamsChangeListener(this.onAllTeamsChange);
        UserStore.addChangeListener(this.onUsersChange);
        UserStore.addInTeamChangeListener(this.onUsersChange);
        TeamStore.addChangeListener(this.onTeamChange);
        TeamStore.addStatsChangeListener(this.onStatsChange);

        loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, this.props.params.team, this.loadComplete);
        getTeamStats(this.props.params.team);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.params.team !== this.props.params.team) {
            const stats = TeamStore.getStats(nextProps.params.team);

            this.setState({
                team: AdminStore.getTeam(nextProps.params.team),
                users: [],
                teamMembers: TeamStore.getMembersInTeam(nextProps.params.team),
                total: stats.total_member_count,
                serverError: null,
                showPasswordModal: false,
                loading: true,
                user: null
            });

            loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, nextProps.params.team, this.loadComplete);
            getTeamStats(nextProps.params.team);
        }
    }

    componentWillUnmount() {
        AdminStore.removeAllTeamsChangeListener(this.onAllTeamsChange);
        UserStore.removeChangeListener(this.onUsersChange);
        UserStore.removeInTeamChangeListener(this.onUsersChange);
        TeamStore.removeChangeListener(this.onTeamChange);
        TeamStore.removeStatsChangeListener(this.onStatsChange);
    }

    loadComplete() {
        this.setState({loading: false});
    }

    onAllTeamsChange() {
        this.setState({
            team: AdminStore.getTeam(this.props.params.team)
        });
    }

    onStatsChange() {
        const stats = TeamStore.getStats(this.props.params.team);
        this.setState({total: stats.total_member_count});
    }

    onUsersChange() {
        this.setState({users: UserStore.getProfileListInTeam(this.props.params.team)});
    }

    onTeamChange() {
        this.setState({teamMembers: TeamStore.getMembersInTeam(this.props.params.team)});
    }

    nextPage(page) {
        loadProfilesAndTeamMembers((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE, this.props.params.team);
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

    doPasswordResetSubmit(user) {
        getUser(user.id);
        this.setState({
            showPasswordModal: false,
            user: null
        });
    }

    search(term) {
        clearTimeout(this.searchTimeoutId);

        if (term === '') {
            this.setState({search: false, users: UserStore.getProfileListInTeam(this.props.params.team)});
            this.searchTimeoutId = '';
            return;
        }

        const options = {};
        options[UserSearchOptions.ALLOW_INACTIVE] = true;

        const searchTimeoutId = setTimeout(
            () => {
                searchUsers(
                    term,
                    this.props.params.team,
                    options,
                    (users) => {
                        if (searchTimeoutId !== this.searchTimeoutId) {
                            return;
                        }

                        this.setState({loading: true, search: true, users});
                        loadTeamMembersForProfilesList(users, this.props.params.team, this.loadComplete);
                    }
                );
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS
        );

        this.searchTimeoutId = searchTimeoutId;
    }

    render() {
        if (!this.state.team) {
            return null;
        }

        const teamMembers = this.state.teamMembers;
        const users = this.state.users;
        const actionUserProps = {};
        const extraInfo = {};
        const mfaEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MFA === 'true' && global.window.mm_config.EnableMultifactorAuthentication === 'true';

        let usersToDisplay;
        if (this.state.loading) {
            usersToDisplay = null;
        } else {
            usersToDisplay = [];

            for (let i = 0; i < users.length; i++) {
                const user = users[i];

                if (teamMembers[user.id]) {
                    usersToDisplay.push(user);
                    actionUserProps[user.id] = {
                        teamMember: teamMembers[user.id]
                    };

                    const info = [];

                    if (user.auth_service) {
                        const service = (user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) ? user.auth_service.toUpperCase() : Utils.toTitleCase(user.auth_service);
                        info.push(
                            <FormattedHTMLMessage
                                key='admin.user_item.authServiceNotEmail'
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
                                key='admin.user_item.authServiceEmail'
                                id='admin.user_item.authServiceEmail'
                                defaultMessage='<strong>Sign-in Method:</strong> Email'
                            />
                        );
                    }

                    if (mfaEnabled) {
                        info.push(', ');
                        if (user.mfa_active) {
                            info.push(
                                <FormattedHTMLMessage
                                    key='admin.user_item.mfaYes'
                                    id='admin.user_item.mfaYes'
                                    defaultMessage='<strong>MFA</strong>: Yes'
                                />
                            );
                        } else {
                            info.push(
                                <FormattedHTMLMessage
                                    key='admin.user_item.mfaNo'
                                    id='admin.user_item.mfaNo'
                                    defaultMessage='<strong>MFA</strong>: No'
                                />
                            );
                        }
                    }

                    extraInfo[user.id] = info;
                }
            }
        }

        return (
            <div className='wrapper--fixed'>
                <h3 className='admin-console-header'>
                    <FormattedMessage
                        id='admin.userList.title2'
                        defaultMessage='Users for {team} ({count})'
                        values={{
                            team: this.state.team.name,
                            count: this.state.total
                        }}
                    />
                </h3>
                <FormError error={this.state.serverError}/>
                <div className='more-modal__list member-list-holder'>
                    <SearchableUserList
                        users={usersToDisplay}
                        usersPerPage={USERS_PER_PAGE}
                        total={this.state.total}
                        extraInfo={extraInfo}
                        nextPage={this.nextPage}
                        search={this.search}
                        actions={[AdminTeamMembersDropdown]}
                        actionProps={{
                            doPasswordReset: this.doPasswordReset
                        }}
                        actionUserProps={actionUserProps}
                    />
                </div>
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
