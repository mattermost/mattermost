// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ConfirmModal from 'components/confirm_modal.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';
import {updateActive} from 'actions/user_actions.jsx';
import {adminResetMfa} from 'actions/admin_actions.jsx';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import {FormattedMessage} from 'react-intl';

import PropTypes from 'prop-types';

import React from 'react';

export default class SystemUsersDropdown extends React.Component {
    static propTypes = {

        /*
         * User to manage with dropdown
         */
        user: PropTypes.object.isRequired,

        /*
         * Function to open password reset, takes user as an argument
         */
        doPasswordReset: PropTypes.func.isRequired,

        /*
         * Function to open manage teams, takes user as an argument
         */
        doManageTeams: PropTypes.func.isRequired,

        /*
         * Function to open manage roles, takes user as an argument
         */
        doManageRoles: PropTypes.func.isRequired,

        /*
         * Function to open manage tokens, takes user as an argument
         */
        doManageTokens: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);

        this.state = {
            serverError: null,
            showDemoteModal: false,
            showDeactivateMemberModal: false,
            user: null,
            role: null
        };
    }

    handleMakeActive = (e) => {
        e.preventDefault();
        updateActive(this.props.user.id, true, null,
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleManageTeams = (e) => {
        e.preventDefault();

        this.props.doManageTeams(this.props.user);
    }

    handleManageRoles = (e) => {
        e.preventDefault();

        this.props.doManageRoles(this.props.user);
    }

    handleManageTokens = (e) => {
        e.preventDefault();

        this.props.doManageTokens(this.props.user);
    }

    handleResetPassword = (e) => {
        e.preventDefault();
        this.props.doPasswordReset(this.props.user);
    }

    handleResetMfa = (e) => {
        e.preventDefault();

        adminResetMfa(this.props.user.id,
            null,
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleDemoteSystemAdmin = (user, role) => {
        this.setState({
            serverError: this.state.serverError,
            showDemoteModal: true,
            user,
            role
        });
    }

    handleDemoteCancel = () => {
        this.setState({
            serverError: null,
            showDemoteModal: false,
            user: null,
            role: null
        });
    }

    handleDemoteSubmit = () => {
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

    handleShowDeactivateMemberModal = (e) => {
        e.preventDefault();

        this.setState({showDeactivateMemberModal: true});
    }

    handleDeactivateMember = () => {
        updateActive(this.props.user.id, false, null,
            (err) => {
                this.setState({serverError: err.message});
            }
        );

        this.setState({showDeactivateMemberModal: false});
    }

    handleDeactivateCancel = () => {
        this.setState({showDeactivateMemberModal: false});
    }

    renderDeactivateMemberModal = () => {
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

    renderAccessToken = () => {
        const userAccessTokensEnabled = global.window.mm_config.EnableUserAccessTokens === 'true';
        if (!userAccessTokensEnabled) {
            return null;
        }

        const user = this.props.user;
        const hasPostAllRole = UserUtils.hasPostAllRole(user.roles);
        const hasPostAllPublicRole = UserUtils.hasPostAllPublicRole(user.roles);
        const hasUserAccessTokenRole = UserUtils.hasUserAccessTokenRole(user.roles);
        const isSystemAdmin = UserUtils.isSystemAdmin(user.roles);

        let messageId = '';
        if (hasUserAccessTokenRole || isSystemAdmin) {
            if (hasPostAllRole) {
                messageId = 'admin.user_item.userAccessTokenPostAll';
            } else if (hasPostAllPublicRole) {
                messageId = 'admin.user_item.userAccessTokenPostAllPublic';
            } else {
                messageId = 'admin.user_item.userAccessTokenYes';
            }
        }

        if (!messageId) {
            return null;
        }

        return (
            <div className='light margin-top half'>
                <FormattedMessage
                    key='admin.user_item.userAccessToken'
                    id={messageId}
                />
            </div>
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
            showMakeActive = true;
            showMakeNotActive = false;
            showManageTeams = false;
        }

        let disableActivationToggle = false;
        if (user.auth_service === Constants.LDAP_SERVICE) {
            disableActivationToggle = true;
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

        let manageTokens;
        if (global.window.mm_config.EnableUserAccessTokens === 'true') {
            manageTokens = (
                <li role='presentation'>
                    <a
                        id='manageTokens'
                        role='menuitem'
                        href='#'
                        onClick={this.handleManageTokens}
                    >
                        <FormattedMessage
                            id='admin.user_item.manageTokens'
                            defaultMessage='Manage Tokens'
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
            <div className='dropdown member-drop text-right'>
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
                {this.renderAccessToken()}
                <ul
                    className='dropdown-menu member-menu'
                    role='menu'
                >
                    {makeActive}
                    {makeNotActive}
                    <li role='presentation'>
                        <a
                            id='manageRoles'
                            role='menuitem'
                            href='#'
                            onClick={this.handleManageRoles}
                        >
                            <FormattedMessage
                                id='admin.user_item.manageRoles'
                                defaultMessage='Manage Roles'
                            />
                        </a>
                    </li>
                    {manageTeams}
                    {manageTokens}
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
