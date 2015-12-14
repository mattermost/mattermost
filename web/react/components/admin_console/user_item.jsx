// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as Utils from '../../utils/utils.jsx';

const messages = defineMessages({
    member: {
        id: 'admin.userItem.member',
        defaultMessage: 'Member'
    },
    systemAdmin: {
        id: 'admin.userItems.systemAdmin',
        defaultMessage: 'System Admin'
    },
    admin: {
        id: 'admin.userItems.admin',
        defaultMessage: 'Team Admin'
    },
    inactive: {
        id: 'admin.userItems.inactive',
        defaultMessage: 'Inactive'
    },
    makeSysAdmin: {
        id: 'admin.userItems.makeSysAdmin',
        defaultMessage: 'Make System Admin'
    },
    makeAdmin: {
        id: 'admin.userItems.makeAdmin',
        defaultMessage: 'Make Team Admin'
    },
    makeMember: {
        id: 'admin.userItems.makeMember',
        defaultMessage: 'Make Member'
    },
    makeActive: {
        id: 'admin.userItems.makeActive',
        defaultMessage: 'Make Active'
    },
    makeInactive: {
        id: 'admin.userItems.makeInactive',
        defaultMessage: 'Make Inactive'
    },
    reset: {
        id: 'admin.userItems.reset',
        defaultMessage: 'Reset Password'
    }
});

class UserItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleMakeMember = this.handleMakeMember.bind(this);
        this.handleMakeActive = this.handleMakeActive.bind(this);
        this.handleMakeNotActive = this.handleMakeNotActive.bind(this);
        this.handleMakeAdmin = this.handleMakeAdmin.bind(this);
        this.handleMakeSystemAdmin = this.handleMakeSystemAdmin.bind(this);
        this.handleResetPassword = this.handleResetPassword.bind(this);

        this.state = {};
    }

    handleMakeMember(e) {
        e.preventDefault();
        const data = {
            user_id: this.props.user.id,
            new_roles: ''
        };

        Client.updateRoles(data,
            () => {
                this.props.refreshProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
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
        const data = {
            user_id: this.props.user.id,
            new_roles: 'admin'
        };

        Client.updateRoles(data,
            () => {
                this.props.refreshProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleMakeSystemAdmin(e) {
        e.preventDefault();
        const data = {
            user_id: this.props.user.id,
            new_roles: 'system_admin'
        };

        Client.updateRoles(data,
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

    render() {
        const {formatMessage} = this.props.intl;
        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='has-error'>
                    <label className='has-error control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        const user = this.props.user;
        let currentRoles = formatMessage(messages.member);
        if (user.roles.length > 0) {
            if (Utils.isSystemAdmin(user.roles)) {
                currentRoles = formatMessage(messages.systemAdmin);
            } else if (Utils.isAdmin(user.roles)) {
                currentRoles = formatMessage(messages.admin);
            }
        }

        const email = user.email;
        let showMakeMember = user.roles === 'admin' || user.roles === 'system_admin';
        let showMakeAdmin = user.roles === '' || user.roles === 'system_admin';
        let showMakeSystemAdmin = user.roles === '' || user.roles === 'admin';
        let showMakeActive = false;
        let showMakeNotActive = user.roles !== 'system_admin';

        if (user.delete_at > 0) {
            currentRoles = formatMessage(messages.inactive);
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
                        {formatMessage(messages.makeSysAdmin)}
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
                        {formatMessage(messages.makeAdmin)}
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
                        {formatMessage(messages.makeMember)}
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
                        {formatMessage(messages.makeActive)}
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
                        {formatMessage(messages.makeInactive)}
                    </a>
                </li>
            );
        }

        return (
            <tr>
                <td className='row member-div'>
                    <img
                        className='post-profile-img pull-left'
                        src={`/api/v1/users/${user.id}/image?time=${user.update_at}&${Utils.getSessionIndex()}`}
                        height='36'
                        width='36'
                    />
                    <span className='member-name'>{Utils.getDisplayName(user)}</span>
                    <span className='member-email'>{email}</span>
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
                            <li role='presentation'>
                                <a
                                    role='menuitem'
                                    href='#'
                                    onClick={this.handleResetPassword}
                                >
                                    {formatMessage(messages.reset)}
                                </a>
                            </li>
                        </ul>
                    </div>
                    {serverError}
                </td>
            </tr>
        );
    }
}

UserItem.propTypes = {
    intl: intlShape.isRequired,
    user: React.PropTypes.object.isRequired,
    refreshProfiles: React.PropTypes.func.isRequired,
    doPasswordReset: React.PropTypes.func.isRequired
};

export default injectIntl(UserItem);