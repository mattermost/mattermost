// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import Client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';
import ConfirmModal from './confirm_modal.jsx';
import TeamStore from 'stores/team_store.jsx';

import {FormattedMessage} from 'react-intl';

import React from 'react';
import {browserHistory} from 'react-router';

export default class TeamMembersDropdown extends React.Component {
    constructor(props) {
        super(props);

        this.handleMakeMember = this.handleMakeMember.bind(this);
        this.handleMakeActive = this.handleMakeActive.bind(this);
        this.handleMakeNotActive = this.handleMakeNotActive.bind(this);
        this.handleMakeAdmin = this.handleMakeAdmin.bind(this);
        this.handleDemote = this.handleDemote.bind(this);
        this.handleDemoteSubmit = this.handleDemoteSubmit.bind(this);
        this.handleDemoteCancel = this.handleDemoteCancel.bind(this);

        this.state = {
            serverError: null,
            showDemoteModal: false,
            user: null,
            role: null
        };
    }
    handleMakeMember() {
        const me = UserStore.getCurrentUser();
        if (this.props.user.id === me.id) {
            this.handleDemote(this.props.user, '');
        } else {
            Client.updateRoles(
                this.props.user.id,
                '',
                () => {
                    AsyncClient.getProfiles();
                },
                (err) => {
                    this.setState({serverError: err.message});
                }
            );
        }
    }
    handleMakeActive() {
        Client.updateActive(this.props.user.id, true,
            () => {
                AsyncClient.getProfiles();
                AsyncClient.getChannelExtraInfo(ChannelStore.getCurrentId());
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    handleMakeNotActive() {
        Client.updateActive(this.props.user.id, false,
            () => {
                AsyncClient.getProfiles();
                AsyncClient.getChannelExtraInfo(ChannelStore.getCurrentId());
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    handleMakeAdmin() {
        const me = UserStore.getCurrentUser();
        if (this.props.user.id === me.id) {
            this.handleDemote(this.props.user, 'admin');
        } else {
            Client.updateRoles(
                this.props.user.id,
                'admin',
                () => {
                    AsyncClient.getProfiles();
                },
                (err) => {
                    this.setState({serverError: err.message});
                }
            );
        }
    }
    handleDemote(user, role, newRole) {
        this.setState({
            serverError: this.state.serverError,
            showDemoteModal: true,
            user,
            role,
            newRole
        });
    }
    handleDemoteCancel() {
        this.setState({
            serverError: null,
            showDemoteModal: false,
            user: null,
            role: null,
            newRole: null
        });
    }
    handleDemoteSubmit() {
        Client.updateRoles(
            this.props.user.id,
            this.state.newRole,
            () => {
                const teamUrl = TeamStore.getCurrentTeamUrl();
                if (teamUrl) {
                    browserHistory.push(teamUrl);
                } else {
                    browserHistory.push('/');
                }
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    render() {
        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='has-error'>
                    <label className='has-error control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        const teamMember = this.props.teamMember;
        const user = this.props.user;
        let currentRoles = (
            <FormattedMessage
                id='team_members_dropdown.member'
                defaultMessage='Member'
            />
        );

        if (user.roles.length > 0) {
            if (Utils.isSystemAdmin(user.roles)) {
                currentRoles = (
                    <FormattedMessage
                        id='team_members_dropdown.systemAdmin'
                        defaultMessage='System Admin'
                    />
                );
            } else if (Utils.isAdmin(user.roles)) {
                currentRoles = (
                    <FormattedMessage
                        id='team_members_dropdown.teamAdmin'
                        defaultMessage='Team Admin'
                    />
                );
            } else {
                currentRoles = user.roles.charAt(0).toUpperCase() + user.roles.slice(1);
            }
        }

        let showMakeMember = teamMember.roles === 'admin' || user.roles === 'system_admin';

        //let showMakeAdmin = teamMember.roles === '' && user.roles !== 'system_admin';
        let showMakeAdmin = false;
        let showMakeActive = false;
        let showMakeNotActive = user.roles !== 'system_admin';

        if (user.delete_at > 0) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.inactive'
                    defaultMessage='Inactive'
                />
            );
            showMakeMember = false;
            showMakeAdmin = false;
            showMakeActive = true;
            showMakeNotActive = false;
        }

        let makeAdmin = null;
        if (showMakeAdmin) {
            makeAdmin = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeAdmin}
                    >
                        <FormattedMessage
                            id='team_members_dropdown.makeAdmin'
                            defaultMessage='Make Team Admin'
                        />
                    </a>
                </li>
            );
        }

        let makeMember = null;
        if (showMakeMember) {
            makeMember = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeMember}
                    >
                        <FormattedMessage
                            id='team_members_dropdown.makeMember'
                            defaultMessage='Make Member'
                        />
                    </a>
                </li>
            );
        }

        let makeActive = null;
        if (showMakeActive) {
            makeActive = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeActive}
                    >
                        <FormattedMessage
                            id='team_members_dropdown.makeActive'
                            defaultMessage='Make Active'
                        />
                    </a>
                </li>
            );
        }

        let makeNotActive = null;
        if (showMakeNotActive) {
            makeNotActive = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeNotActive}
                    >
                        <FormattedMessage
                            id='team_members_dropdown.makeInactive'
                            defaultMessage='Make Inactive'
                        />
                    </a>
                </li>
            );
        }
        const me = UserStore.getCurrentUser();
        let makeDemoteModal = null;
        if (this.props.user.id === me.id) {
            const title = (
                <FormattedMessage
                    id='team_members_dropdown.confirmDemoteRoleTitle'
                    defaultMessage='Confirm demotion from System Admin role'
                />
            );

            const message = (
                <div>
                    <FormattedMessage
                        id='team_members_dropdown.confirmDemoteDescription'
                        defaultMessage="If you demote yourself from the System Admin role and there is not another user with System Admin privileges, you'll need to re-assign a System Admin by accessing the Mattermost server through a terminal and running the following command."
                    />
                    <br/>
                    <br/>
                    <FormattedMessage
                        id='team_members_dropdown.confirmDemotionCmd'
                        defaultMessage='platform -assign_role -team_name="yourteam" -email="name@yourcompany.com" -role="system_admin"'
                    />
                    {serverError}
                </div>
            );

            const confirmButton = (
                <FormattedMessage
                    id='team_members_dropdown.confirmDemotion'
                    defaultMessage='Confirm Demotion'
                />
            );

            makeDemoteModal = (
                <ConfirmModal
                    show={this.state.showDemoteModal}
                    title={title}
                    message={message}
                    confirmButton={confirmButton}
                    onConfirm={this.handleDemoteSubmit}
                    onCancel={this.handleDemoteCancel}
                />
            );
        }

        return (
            <div className='dropdown member-drop'>
                <a
                    href='#'
                    className='dropdown-toggle theme'
                    type='button'
                    data-toggle='dropdown'
                    aria-expanded='true'
                >
                    <span>{currentRoles} </span>
                    <span className='fa fa-chevron-down'></span>
                </a>
                <ul
                    className='dropdown-menu member-menu'
                    role='menu'
                >
                    {makeAdmin}
                    {makeMember}
                    {makeActive}
                    {makeNotActive}
                </ul>
                {makeDemoteModal}
                {serverError}
            </div>
        );
    }
}

TeamMembersDropdown.propTypes = {
    user: React.PropTypes.object.isRequired,
    teamMember: React.PropTypes.object.isRequired
};
