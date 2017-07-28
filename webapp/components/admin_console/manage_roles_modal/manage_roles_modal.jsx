// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as UserUtils from 'mattermost-redux/utils/user_utils';
import {Client4} from 'mattermost-redux/client';
import {General} from 'mattermost-redux/constants';

import {trackEvent} from 'actions/diagnostics_actions.jsx';

import React from 'react';
import {Modal} from 'react-bootstrap';
import PropTypes from 'prop-types';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

function getStateFromProps(props) {
    const roles = props.user && props.user.roles ? props.user.roles : '';

    return {
        error: null,
        hasPostAllRole: UserUtils.hasPostAllRole(roles),
        hasPostAllPublicRole: UserUtils.hasPostAllPublicRole(roles),
        hasUserAccessTokenRole: UserUtils.hasUserAccessTokenRole(roles),
        isSystemAdmin: UserUtils.isSystemAdmin(roles)
    };
}

export default class ManageRolesModal extends React.PureComponent {
    static propTypes = {

        /**
         * Set to render the modal
         */
        show: PropTypes.bool.isRequired,

        /**
         * The user the roles are being managed for
         */
        user: PropTypes.object,

        /**
         * Set if user access tokens are enabled
         */
        userAccessTokensEnabled: PropTypes.bool.isRequired,

        /**
         * Function called when modal is dismissed
         */
        onModalDismissed: PropTypes.func.isRequired,

        actions: PropTypes.shape({

            /**
             * Function to update a user's roles
             */
            updateUserRoles: PropTypes.func.isRequired
        }).isRequired
    };

    constructor(props) {
        super(props);
        this.state = getStateFromProps(props);
    }

    componentWillReceiveProps(nextProps) {
        const user = this.props.user || {};
        const nextUser = nextProps.user || {};
        if (user.id !== nextUser.id) {
            this.setState(getStateFromProps(nextProps));
        }
    }

    handleError = (error) => {
        this.setState({
            error
        });
    }

    handleSystemAdminChange = (e) => {
        if (e.target.name === 'systemadmin') {
            this.setState({isSystemAdmin: true});
        } else if (e.target.name === 'systemmember') {
            this.setState({isSystemAdmin: false});
        }
    };

    handleUserAccessTokenChange = (e) => {
        this.setState({
            hasUserAccessTokenRole: e.target.checked
        });
    };

    handlePostAllChange = (e) => {
        this.setState({
            hasPostAllRole: e.target.checked
        });
    };

    handlePostAllPublicChange = (e) => {
        this.setState({
            hasPostAllPublicRole: e.target.checked
        });
    };

    trackRoleChanges = (roles, oldRoles) => {
        if (UserUtils.hasUserAccessTokenRole(roles) && !UserUtils.hasUserAccessTokenRole(oldRoles)) {
            trackEvent('actions', 'add_roles', {role: General.SYSTEM_USER_ACCESS_TOKEN_ROLE});
        } else if (!UserUtils.hasUserAccessTokenRole(roles) && UserUtils.hasUserAccessTokenRole(oldRoles)) {
            trackEvent('actions', 'remove_roles', {role: General.SYSTEM_USER_ACCESS_TOKEN_ROLE});
        }

        if (UserUtils.hasPostAllRole(roles) && !UserUtils.hasPostAllRole(oldRoles)) {
            trackEvent('actions', 'add_roles', {role: General.SYSTEM_POST_ALL_ROLE});
        } else if (!UserUtils.hasPostAllRole(roles) && UserUtils.hasPostAllRole(oldRoles)) {
            trackEvent('actions', 'remove_roles', {role: General.SYSTEM_POST_ALL_ROLE});
        }

        if (UserUtils.hasPostAllPublicRole(roles) && !UserUtils.hasPostAllPublicRole(oldRoles)) {
            trackEvent('actions', 'add_roles', {role: General.SYSTEM_POST_ALL_PUBLIC_ROLE});
        } else if (!UserUtils.hasPostAllPublicRole(roles) && UserUtils.hasPostAllPublicRole(oldRoles)) {
            trackEvent('actions', 'remove_roles', {role: General.SYSTEM_POST_ALL_PUBLIC_ROLE});
        }
    }

    handleSave = async () => {
        this.setState({error: null});

        let roles = General.SYSTEM_USER_ROLE;

        if (this.state.isSystemAdmin) {
            roles += ' ' + General.SYSTEM_ADMIN_ROLE;
        } else if (this.state.hasUserAccessTokenRole) {
            roles += ' ' + General.SYSTEM_USER_ACCESS_TOKEN_ROLE;
            if (this.state.hasPostAllRole) {
                roles += ' ' + General.SYSTEM_POST_ALL_ROLE;
            } else if (this.state.hasPostAllPublicRole) {
                roles += ' ' + General.SYSTEM_POST_ALL_PUBLIC_ROLE;
            }
        }

        const data = await this.props.actions.updateUserRoles(this.props.user.id, roles);

        this.trackRoleChanges(roles, this.props.user.roles);

        if (data) {
            this.props.onModalDismissed();
        } else {
            this.handleError(
                <FormattedMessage
                    id='admin.manage_roles.saveError'
                    defaultMessage='Unable to save roles.'
                />
            );
        }
    }

    renderContents = () => {
        const {user} = this.props;

        if (user == null) {
            return <div/>;
        }

        let name = UserUtils.getFullName(user);
        if (name) {
            name += ` (@${user.username})`;
        } else {
            name = `@${user.username}`;
        }

        let additionalRoles;
        if (this.state.hasUserAccessTokenRole || this.state.isSystemAdmin) {
            additionalRoles = (
                <div>
                    <p>
                        <FormattedHTMLMessage
                            id='admin.manage_roles.additionalRoles'
                            defaultMessage='Select additional permissions for the account. <a href="https://about.mattermost.com/default-permissions" target="_blank">Read more about roles and permissions</a>.'
                        />
                    </p>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                ref='postall'
                                checked={this.state.hasPostAllRole || this.state.isSystemAdmin}
                                disabled={this.state.isSystemAdmin}
                                onChange={this.handlePostAllChange}
                            />
                            <strong>
                                <FormattedMessage
                                    id='admin.manage_roles.postAllRoleTitle'
                                    defaultMessage='post:all'
                                />
                            </strong>
                            <FormattedMessage
                                id='admin.manage_roles.postAllRole'
                                defaultMessage='Access to post to all Mattermost channels including direct messages.'
                            />
                        </label>
                    </div>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                ref='postallpublic'
                                checked={this.state.hasPostAllPublicRole || this.state.hasPostAllRole || this.state.isSystemAdmin}
                                disabled={this.state.hasPostAllRole || this.state.isSystemAdmin}
                                onChange={this.handlePostAllPublicChange}
                            />
                            <strong>
                                <FormattedMessage
                                    id='admin.manage_roles.postAllPublicRoleTitle'
                                    defaultMessage='post:channels'
                                />
                            </strong>
                            <FormattedMessage
                                id='admin.manage_roles.postAllPublicRole'
                                defaultMessage='Access to post to all Mattermost public channels.'
                            />
                        </label>
                    </div>
                </div>
            );
        }

        let userAccessTokenContent;
        if (this.props.userAccessTokensEnabled) {
            userAccessTokenContent = (
                <div>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                ref='postall'
                                checked={this.state.hasUserAccessTokenRole || this.state.isSystemAdmin}
                                disabled={this.state.isSystemAdmin}
                                onChange={this.handleUserAccessTokenChange}
                            />
                            <FormattedHTMLMessage
                                id='admin.manage_roles.allowUserAccessTokens'
                                defaultMessage='Allow this account to generate <a href="https://about.mattermost.com/default-user-access-tokens" target="_blank">user access tokens</a>.'
                            />
                        </label>
                    </div>
                    <div className='member-row--padded'>
                        {additionalRoles}
                    </div>
                </div>
            );
        }

        return (
            <div>
                <div className='manage-teams__user'>
                    <img
                        className='manage-teams__profile-picture'
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                    />
                    <div className='manage-teams__info'>
                        <div className='manage-teams__name'>
                            {name}
                        </div>
                        <div className='manage-teams__email'>
                            {user.email}
                        </div>
                    </div>
                </div>
                <div>
                    <div className='manage-row--inner'>
                        <div className='radio-inline'>
                            <label>
                                <input
                                    name='systemadmin'
                                    type='radio'
                                    checked={this.state.isSystemAdmin}
                                    onChange={this.handleSystemAdminChange}
                                />
                                <FormattedMessage
                                    id='admin.manage_roles.systemAdmin'
                                    defaultMessage='System Admin'
                                />
                            </label>
                        </div>
                        <div className='radio-inline'>
                            <label>
                                <input
                                    name='systemmember'
                                    type='radio'
                                    checked={!this.state.isSystemAdmin}
                                    onChange={this.handleSystemAdminChange}
                                />
                                <FormattedMessage
                                    id='admin.manage_roles.systemMember'
                                    defaultMessage='Member'
                                />
                            </label>
                        </div>
                    </div>
                    {userAccessTokenContent}
                </div>
            </div>
        );
    }

    render() {
        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onModalDismissed}
                dialogClassName='manage-teams'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='admin.manage_roles.manageRolesTitle'
                            defaultMessage='Manage Roles'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.renderContents()}
                    {this.state.error}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-link'
                        onClick={this.props.onModalDismissed}
                    >
                        <FormattedMessage
                            id='admin.manage_roles.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleSave}
                    >
                        <FormattedMessage
                            id='admin.manage_roles.save'
                            defaultMessage='Save'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
