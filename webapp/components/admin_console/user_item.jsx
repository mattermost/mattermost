// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'utils/web_client.jsx';
import * as Utils from 'utils/utils.jsx';
import UserStore from 'stores/user_store.jsx';
import ConfirmModal from '../confirm_modal.jsx';
import TeamStore from 'stores/team_store.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import React from 'react';
import {browserHistory} from 'react-router';

export default class UserItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleMakeMember = this.handleMakeMember.bind(this);
        this.handleMakeActive = this.handleMakeActive.bind(this);
        this.handleMakeNotActive = this.handleMakeNotActive.bind(this);
        this.handleMakeAdmin = this.handleMakeAdmin.bind(this);
        this.handleMakeSystemAdmin = this.handleMakeSystemAdmin.bind(this);
        this.handleResetPassword = this.handleResetPassword.bind(this);
        this.handleResetMfa = this.handleResetMfa.bind(this);
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

    handleMakeMember(e) {
        e.preventDefault();
        const me = UserStore.getCurrentUser();
        if (this.props.user.id === me.id) {
            this.handleDemote(this.props.user, '');
        } else {
            Client.updateRoles(
                this.props.user.id,
                '',
                () => {
                    this.props.refreshProfiles();
                },
                (err) => {
                    this.setState({serverError: err.message});
                }
            );
        }
    }

    handleMakeActive(e) {
        e.preventDefault();
        Client.updateActive(this.props.user.id, true,
            () => {
                this.props.refreshProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeNotActive(e) {
        e.preventDefault();
        Client.updateActive(this.props.user.id, false,
            () => {
                this.props.refreshProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeAdmin(e) {
        e.preventDefault();
        const me = UserStore.getCurrentUser();
        if (this.props.user.id === me.id) {
            this.handleDemote(this.props.user, 'admin');
        } else {
            Client.updateRoles(
                this.props.user.id,
                'admin',
                () => {
                    this.props.refreshProfiles();
                },
                (err) => {
                    this.setState({serverError: err.message});
                }
            );
        }
    }

    handleMakeSystemAdmin(e) {
        e.preventDefault();

        Client.updateRoles(
            this.props.user.id,
            'system_admin',
            () => {
                this.props.refreshProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleResetPassword(e) {
        e.preventDefault();
        this.props.doPasswordReset(this.props.user);
    }

    handleResetMfa(e) {
        e.preventDefault();

        Client.adminResetMfa(this.props.user.id,
            () => {
                this.props.refreshProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleDemote(user, role) {
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
        Client.updateRoles(
            this.props.user.id,
            this.state.role,
            () => {
                this.setState({
                    serverError: null,
                    showDemoteModal: false,
                    user: null,
                    role: null
                });

                const teamUrl = TeamStore.getCurrentTeamUrl();
                if (teamUrl) {
                    browserHistory.push(teamUrl);
                } else {
                    browserHistory.push('/');
                }
            },
            (err) => {
                this.setState({
                    serverError: err.message
                });
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

        const user = this.props.user;
        let currentRoles = (
            <FormattedMessage
                id='admin.user_item.member'
                defaultMessage='Member'
            />
        );
        if (user.roles.length > 0) {
            if (Utils.isSystemAdmin(user.roles)) {
                currentRoles = (
                    <FormattedMessage
                        id='admin.user_item.sysAdmin'
                        defaultMessage='System Admin'
                    />
                );
            } else if (Utils.isAdmin(user.roles)) {
                currentRoles = (
                    <FormattedMessage
                        id='admin.user_item.teamAdmin'
                        defaultMessage='Team Admin'
                    />
                );
            } else {
                currentRoles = user.roles.charAt(0).toUpperCase() + user.roles.slice(1);
            }
        }

        const email = user.email;
        let showMakeMember = user.roles === 'admin' || user.roles === 'system_admin';

        //let showMakeAdmin = user.roles === '' || user.roles === 'system_admin';
        let showMakeAdmin = false;

        let showMakeSystemAdmin = user.roles === '' || user.roles === 'admin';
        let showMakeActive = false;
        let showMakeNotActive = user.roles !== 'system_admin';
        let mfaEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MFA === 'true' && global.window.mm_config.EnableMultifactorAuthentication === 'true';
        let showMfaReset = mfaEnabled && user.mfa_active;

        if (user.delete_at > 0) {
            currentRoles = (
                <FormattedMessage
                    id='admin.user_item.inactive'
                    defaultMessage='Inactive'
                />
            );
            showMakeMember = false;
            showMakeAdmin = false;
            showMakeSystemAdmin = false;
            showMakeActive = true;
            showMakeNotActive = false;
        }

        let makeSystemAdmin = null;
        if (showMakeSystemAdmin) {
            makeSystemAdmin = (
                <li role='presentation'>
                    <a
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
                            id='admin.user_item.makeTeamAdmin'
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
                            id='admin.user_item.makeMember'
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
                            id='admin.user_item.makeActive'
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
                            id='admin.user_item.makeInactive'
                            defaultMessage='Make Inactive'
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

        let mfaActiveText;
        if (mfaEnabled) {
            if (user.mfa_active) {
                mfaActiveText = (
                    <FormattedHTMLMessage
                        id='admin.user_item.mfaYes'
                        defaultMessage=', <strong>MFA</strong>: Yes'
                    />
                );
            } else {
                mfaActiveText = (
                    <FormattedHTMLMessage
                        id='admin.user_item.mfaNo'
                        defaultMessage=', <strong>MFA</strong>: No'
                    />
                );
            }
        }

        let authServiceText;
        if (user.auth_service) {
            authServiceText = (
                <FormattedHTMLMessage
                    id='admin.user_item.authServiceNotEmail'
                    defaultMessage=', <strong>Sign-in Method:</strong> {service}'
                    values={{
                        service: Utils.toTitleCase(user.auth_service)
                    }}
                />
            );
        } else {
            authServiceText = (
                <FormattedHTMLMessage
                    id='admin.user_item.authServiceEmail'
                    defaultMessage=', <strong>Sign-in Method:</strong> Email'
                />
            );
        }

        const me = UserStore.getCurrentUser();
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
                        defaultMessage='platform -assign_role -team_name="yourteam" -email="name@yourcompany.com" -role="system_admin"'
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
                    confirmButton={confirmButton}
                    onConfirm={this.handleDemoteSubmit}
                    onCancel={this.handleDemoteCancel}
                />
            );
        }

        return (
            <div className='more-modal__row'>
                <img
                    className='more-modal__image pull-left'
                    src={`${Client.getUsersRoute()}/${user.id}/image?time=${user.update_at}`}
                    height='36'
                    width='36'
                />
                <div className='more-modal__details'>
                    <div className='more-modal__name'>{Utils.getDisplayName(user)}</div>
                    <div className='more-modal__description'>
                        <FormattedHTMLMessage
                            id='admin.user_item.emailTitle'
                            defaultMessage='<strong>Email:</strong> {email}'
                            values={{
                                email
                            }}
                        />
                        {authServiceText}
                        {mfaActiveText}
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <div className='dropdown member-drop'>
                        <a
                            href='#'
                            className='dropdown-toggle theme'
                            type='button'
                            data-toggle='dropdown'
                            aria-expanded='true'
                        >
                            <span>{currentRoles} </span>
                            <span className='caret'></span>
                        </a>
                        <ul
                            className='dropdown-menu member-menu'
                            role='menu'
                        >
                            {makeAdmin}
                            {makeMember}
                            {makeActive}
                            {makeNotActive}
                            {makeSystemAdmin}
                            {mfaReset}
                            <li role='presentation'>
                                <a
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
                        </ul>
                    </div>
                </div>
                {makeDemoteModal}
                {serverError}
            </div>
        );
    }
}

UserItem.propTypes = {
    user: React.PropTypes.object.isRequired,
    refreshProfiles: React.PropTypes.func.isRequired,
    doPasswordReset: React.PropTypes.func.isRequired
};
