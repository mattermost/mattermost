// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ConfirmModal from 'components/confirm_modal.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import {removeUserFromTeam, updateTeamMemberRoles} from 'actions/team_actions.jsx';
import {loadMyTeamMembers, updateActive} from 'actions/user_actions.jsx';

import * as Utils from 'utils/utils.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

export default class TeamMembersDropdown extends React.Component {
    static propTypes = {
        user: PropTypes.object.isRequired,
        teamMember: PropTypes.object.isRequired,
        actions: PropTypes.shape({
            getUser: PropTypes.func.isRequired,
            getTeamStats: PropTypes.func.isRequired,
            getChannelStats: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.handleMakeMember = this.handleMakeMember.bind(this);
        this.handleRemoveFromTeam = this.handleRemoveFromTeam.bind(this);
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
        if (this.props.user.id === me.id && me.roles.includes('system_admin')) {
            this.handleDemote(this.props.user, 'team_user');
        } else {
            updateTeamMemberRoles(
                this.props.teamMember.team_id,
                this.props.user.id,
                'team_user',
                () => {
                    this.props.actions.getUser(this.props.user.id);

                    if (this.props.user.id === me.id) {
                        loadMyTeamMembers();
                    }
                },
                (err) => {
                    this.setState({serverError: err.message});
                }
            );
        }
    }

    handleRemoveFromTeam() {
        removeUserFromTeam(
            this.props.teamMember.team_id,
            this.props.user.id,
            () => {
                UserStore.removeProfileFromTeam(this.props.teamMember.team_id, this.props.user.id);
                UserStore.emitInTeamChange();
                this.props.actions.getTeamStats(this.props.teamMember.team_id);
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeActive() {
        updateActive(this.props.user.id, true,
            () => {
                this.props.actions.getChannelStats(ChannelStore.getCurrentId());
                this.props.actions.getTeamStats(this.props.teamMember.team_id);
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeNotActive() {
        updateActive(this.props.user.id, false,
            () => {
                this.props.actions.getChannelStats(ChannelStore.getCurrentId());
                this.props.actions.getTeamStats(this.props.teamMember.team_id);
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeAdmin() {
        const me = UserStore.getCurrentUser();
        if (this.props.user.id === me.id && me.roles.includes('system_admin')) {
            this.handleDemote(this.props.user, 'team_user team_admin');
        } else {
            updateTeamMemberRoles(
                this.props.teamMember.team_id,
                this.props.user.id,
                'team_user team_admin',
                () => {
                    this.props.actions.getUser(this.props.user.id);
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
        updateTeamMemberRoles(
            this.props.teamMember.team_id,
            this.props.user.id,
            this.state.newRole,
            () => {
                this.props.actions.getUser(this.props.user.id);

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

        if (teamMember.roles.length > 0 && Utils.isAdmin(teamMember.roles)) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.teamAdmin'
                    defaultMessage='Team Admin'
                />
            );
        }

        if (user.roles.length > 0 && Utils.isSystemAdmin(user.roles)) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.systemAdmin'
                    defaultMessage='System Admin'
                />
            );
        }

        const me = UserStore.getCurrentUser();
        let showMakeMember = Utils.isAdmin(teamMember.roles) && !Utils.isSystemAdmin(user.roles);
        let showMakeAdmin = !Utils.isAdmin(teamMember.roles) && !Utils.isSystemAdmin(user.roles);
        let showMakeActive = false;
        let showMakeNotActive = Utils.isSystemAdmin(user.roles);

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

        let removeFromTeam = null;
        if (this.props.user.id !== me.id) {
            removeFromTeam = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleRemoveFromTeam}
                    >
                        <FormattedMessage
                            id='team_members_dropdown.leave_team'
                            defaultMessage='Remove From Team'
                        />
                    </a>
                </li>
            );
        }

        const makeActive = null;
        if (showMakeActive) {
            // makeActive = (
            //     <li role='presentation'>
            //         <a
            //             role='menuitem'
            //             href='#'
            //             onClick={this.handleMakeActive}
            //         >
            //             <FormattedMessage
            //                 id='team_members_dropdown.makeActive'
            //                 defaultMessage='Activate'
            //             />
            //         </a>
            //     </li>
            // );
        }

        const makeNotActive = null;
        if (showMakeNotActive) {
            // makeNotActive = (
            //     <li role='presentation'>
            //         <a
            //             role='menuitem'
            //             href='#'
            //             onClick={this.handleMakeNotActive}
            //         >
            //             <FormattedMessage
            //                 id='team_members_dropdown.makeInactive'
            //                 defaultMessage='Deactivate'
            //             />
            //         </a>
            //     </li>
            // );
        }

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
                        defaultMessage='platform roles system_admin {username}'
                        vallues={{
                            username: me.username
                        }}
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
                    confirmButtonText={confirmButton}
                    onConfirm={this.handleDemoteSubmit}
                    onCancel={this.handleDemoteCancel}
                />
            );
        }

        if (!removeFromTeam && !makeAdmin && !makeMember && !makeActive && !makeNotActive) {
            return <div>{currentRoles}</div>;
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
                    <span className='fa fa-chevron-down'/>
                </a>
                <ul
                    className='dropdown-menu member-menu'
                    role='menu'
                >
                    {removeFromTeam}
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
