// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ConfirmModal from 'components/confirm_modal.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';
import {updateUserRoles, updateActive} from 'actions/user_actions.jsx';
import {adminResetMfa} from 'actions/admin_actions.jsx';

import {FormattedMessage} from 'react-intl';

import PropTypes from 'prop-types';

import React from 'react';

export default class SystemUsersDropdown extends React.Component {
    static propTypes = {
        user: PropTypes.object.isRequired,
        doPasswordReset: PropTypes.func.isRequired,
        doManageTeams: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);

        this.handleMakeMember = this.handleMakeMember.bind(this);
        this.handleMakeActive = this.handleMakeActive.bind(this);
        this.handleShowDeactivateMemberModal = this.handleShowDeactivateMemberModal.bind(this);
        this.handleDeactivateMember = this.handleDeactivateMember.bind(this);
        this.handleDeactivateCancel = this.handleDeactivateCancel.bind(this);
        this.handleMakeSystemAdmin = this.handleMakeSystemAdmin.bind(this);
        this.handleManageTeams = this.handleManageTeams.bind(this);
        this.handleResetPassword = this.handleResetPassword.bind(this);
        this.handleResetMfa = this.handleResetMfa.bind(this);
        this.handleDemoteSystemAdmin = this.handleDemoteSystemAdmin.bind(this);
        this.handleDemoteSubmit = this.handleDemoteSubmit.bind(this);
        this.handleDemoteCancel = this.handleDemoteCancel.bind(this);
        this.renderDeactivateMemberModal = this.renderDeactivateMemberModal.bind(this);

        this.state = {
            serverError: null,
            showDemoteModal: false,
            showDeactivateMemberModal: false,
            user: null,
            role: null
        };
    }

    doMakeMember() {
        updateUserRoles(
            this.props.user.id,
            'system_user',
            null,
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeMember(e) {
        e.preventDefault();
        const me = UserStore.getCurrentUser();
        if (this.props.user.id === me.id && me.roles.includes('system_admin')) {
            this.handleDemoteSystemAdmin(this.props.user, 'member');
        } else {
            this.doMakeMember();
        }
    }

    handleMakeActive(e) {
        e.preventDefault();
        updateActive(this.props.user.id, true, null,
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeSystemAdmin(e) {
        e.preventDefault();

        updateUserRoles(
            this.props.user.id,
            'system_user system_admin',
            null,
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleManageTeams(e) {
        e.preventDefault();

        this.props.doManageTeams(this.props.user);
    }

    handleResetPassword(e) {
        e.preventDefault();
        this.props.doPasswordReset(this.props.user);
    }

    handleResetMfa(e) {
        e.preventDefault();

        adminResetMfa(this.props.user.id,
            null,
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleDemoteSystemAdmin(user, role) {
        this.setState({
            serverError: this.state.serverError,
            showDemoteModal: true,
            user,
            role
        });
    }

    handleDemoteCancel() {
        this.setState({
            serverError: null,
            showDemoteModal: false,
            user: null,
            role: null
        });
    }

    handleDemoteSubmit() {
        if (this.state.role === 'member') {
            this.doMakeMember();
        }

        const teamUrl = TeamStore.getCurrentTeamUrl();
        if (teamUrl) {
            // the channel is added to the URL cause endless loading not being fully fixed
            window.location.href = teamUrl + '/channels/town-square';
        } else {
            window.location.href = '/';
        }
    }

    handleShowDeactivateMemberModal(e) {
        e.preventDefault();

        this.setState({showDeactivateMemberModal: true});
    }

    handleDeactivateMember() {
        updateActive(this.props.user.id, false, null,
            (err) => {
                this.setState({serverError: err.message});
            }
        );

        this.setState({showDeactivateMemberModal: false});
    }

    handleDeactivateCancel() {
        this.setState({showDeactivateMemberModal: false});
    }

    renderDeactivateMemberModal() {
        const title = (
            <FormattedMessage
                id='deactivate_member_modal.title'
                defaultMessage='Deactivate {username}'
                values={{
                    username: this.props.user.username
                }}
            />
        );

        const message = (
            <FormattedMessage
                id='deactivate_member_modal.desc'
                defaultMessage='This action deactivates {username}. They will be logged out and not have access to any teams or channels on this system. Are you sure you want to deactivate {username}?'
                values={{
                    username: this.props.user.username
                }}
            />
        );

        const confirmButtonClass = 'btn btn-danger';
        const deactivateMemberButton = (
            <FormattedMessage
                id='deactivate_member_modal.deactivate'
                defaultMessage='Deactivate'
            />
        );

        return (
            <ConfirmModal
                show={this.state.showDeactivateMemberModal}
                title={title}
                message={message}
                confirmButtonClass={confirmButtonClass}
                confirmButtonText={deactivateMemberButton}
                onConfirm={this.handleDeactivateMember}
                onCancel={this.handleDeactivateCancel}
            />
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

        const user = this.props.user;
        if (!user) {
            return <div/>;
        }
        let currentRoles = (
            <FormattedMessage
                id='admin.user_item.member'
                defaultMessage='Member'
            />
        );

        if (user.roles.length > 0 && Utils.isSystemAdmin(user.roles)) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.systemAdmin'
                    defaultMessage='System Admin'
                />
            );
        }

        const me = UserStore.getCurrentUser();
        let showMakeMember = Utils.isSystemAdmin(user.roles);
        let showMakeSystemAdmin = !Utils.isSystemAdmin(user.roles);
        let showMakeActive = false;
        let showMakeNotActive = !Utils.isSystemAdmin(user.roles);
        let showManageTeams = true;
        const mfaEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MFA === 'true' && global.window.mm_config.EnableMultifactorAuthentication === 'true';
        const showMfaReset = mfaEnabled && user.mfa_active;

        if (user.delete_at > 0) {
            currentRoles = (
                <FormattedMessage
                    id='admin.user_item.inactive'
                    defaultMessage='Inactive'
                />
            );
            showMakeMember = false;
            showMakeSystemAdmin = false;
            showMakeActive = true;
            showMakeNotActive = false;
            showManageTeams = false;
        }

        let disableActivationToggle = false;
        if (user.auth_service === Constants.LDAP_SERVICE) {
            disableActivationToggle = true;
        }

        let makeSystemAdmin = null;
        if (showMakeSystemAdmin) {
            makeSystemAdmin = (
                <li role='presentation'>
                    <a
                        id='makeSystemAdmin'
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeSystemAdmin}
                    >
                        <FormattedMessage
                            id='admin.user_item.makeSysAdmin'
                            defaultMessage='Make System Admin'
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
                        id='makeMember'
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeMember}
                    >
                        <FormattedMessage
                            id='admin.user_item.makeMember'
                            defaultMessage='Make Member'
                        />
                    </a>
                </li>
            );
        }

        let menuClass = '';
        if (disableActivationToggle) {
            menuClass = 'disabled';
        }

        let makeActive = null;
        if (showMakeActive) {
            makeActive = (
                <li
                    role='presentation'
                    className={menuClass}
                >
                    <a
                        id='activate'
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeActive}
                    >
                        <FormattedMessage
                            id='admin.user_item.makeActive'
                            defaultMessage='Activate'
                        />
                    </a>
                </li>
            );
        }

        let makeNotActive = null;
        if (showMakeNotActive) {
            makeNotActive = (
                <li
                    role='presentation'
                    className={menuClass}
                >
                    <a
                        id='deactivate'
                        role='menuitem'
                        href='#'
                        onClick={this.handleShowDeactivateMemberModal}
                    >
                        <FormattedMessage
                            id='admin.user_item.makeInactive'
                            defaultMessage='Deactivate'
                        />
                    </a>
                </li>
            );
        }

        let manageTeams = null;
        if (showManageTeams) {
            manageTeams = (
                <li role='presentation'>
                    <a
                        id='manageTeams'
                        role='menuitem'
                        href='#'
                        onClick={this.handleManageTeams}
                    >
                        <FormattedMessage
                            id='admin.user_item.manageTeams'
                            defaultMessage='Manage Teams'
                        />
                    </a>
                </li>
            );
        }

        let mfaReset = null;
        if (showMfaReset) {
            mfaReset = (
                <li role='presentation'>
                    <a
                        id='removeMFA'
                        role='menuitem'
                        href='#'
                        onClick={this.handleResetMfa}
                    >
                        <FormattedMessage
                            id='admin.user_item.resetMfa'
                            defaultMessage='Remove MFA'
                        />
                    </a>
                </li>
            );
        }

        let passwordReset;
        if (user.auth_service) {
            passwordReset = (
                <li role='presentation'>
                    <a
                        id='switchEmailPassword'
                        role='menuitem'
                        href='#'
                        onClick={this.handleResetPassword}
                    >
                        <FormattedMessage
                            id='admin.user_item.switchToEmail'
                            defaultMessage='Switch to Email/Password'
                        />
                    </a>
                </li>
            );
        } else {
            passwordReset = (
                <li role='presentation'>
                    <a
                        id='resetPassword'
                        role='menuitem'
                        href='#'
                        onClick={this.handleResetPassword}
                    >
                        <FormattedMessage
                            id='admin.user_item.resetPwd'
                            defaultMessage='Reset Password'
                        />
                    </a>
                </li>
            );
        }

        let makeDemoteModal = null;
        if (this.props.user.id === me.id) {
            const title = (
                <FormattedMessage
                    id='admin.user_item.confirmDemoteRoleTitle'
                    defaultMessage='Confirm demotion from System Admin role'
                />
            );

            const message = (
                <div>
                    <FormattedMessage
                        id='admin.user_item.confirmDemoteDescription'
                        defaultMessage="If you demote yourself from the System Admin role and there is not another user with System Admin privileges, you'll need to re-assign a System Admin by accessing the Mattermost server through a terminal and running the following command."
                    />
                    <br/>
                    <br/>
                    <FormattedMessage
                        id='admin.user_item.confirmDemotionCmd'
                        defaultMessage='platform roles system_admin {username}'
                        values={{
                            username: me.username
                        }}
                    />
                    {serverError}
                </div>
            );

            const confirmButton = (
                <FormattedMessage
                    id='admin.user_item.confirmDemotion'
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

        const deactivateMemberModal = this.renderDeactivateMemberModal();

        let displayedName = Utils.getDisplayName(user);
        if (displayedName !== user.username) {
            displayedName += ' (@' + user.username + ')';
        }

        return (
            <div className='dropdown member-drop'>
                <a
                    id='memberDropdown'
                    href='#'
                    className='dropdown-toggle theme'
                    type='button'
                    data-toggle='dropdown'
                    aria-expanded='true'
                >
                    <span>{currentRoles} </span>
                    <span className='caret'/>
                </a>
                <ul
                    className='dropdown-menu member-menu'
                    role='menu'
                >
                    {makeMember}
                    {makeActive}
                    {makeNotActive}
                    {makeSystemAdmin}
                    {manageTeams}
                    {mfaReset}
                    {passwordReset}
                </ul>
                {makeDemoteModal}
                {deactivateMemberModal}
                {serverError}
            </div>
        );
    }
}
