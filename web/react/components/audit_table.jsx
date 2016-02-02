// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import * as Utils from '../utils/utils.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    sessionRevoked: {
        id: 'audit_table.sessionRevoked',
        defaultMessage: 'The session with id {sessionId} was revoked'
    },
    channelCreated: {
        id: 'audit_table.channelCreated',
        defaultMessage: 'Created the {channelName} channel/group'
    },
    establishedDM: {
        id: 'audit_table.establishedDM',
        defaultMessage: 'Established a direct message channel with {username}'
    },
    nameUpdated: {
        id: 'audit_table.nameUpdated',
        defaultMessage: 'Updated the {channelName} channel/group name'
    },
    headerUpdated: {
        id: 'audit_table.headerUpdated',
        defaultMessage: 'Updated the {channelName} channel/group header'
    },
    channelDeleted: {
        id: 'audit_table.channelDeleted',
        defaultMessage: 'Deleted the channel/group with the URL {url}'
    },
    userAdded: {
        id: 'audit_table.userAdded',
        defaultMessage: 'Added {username} to the {channelName} channel/group'
    },
    userRemoved: {
        id: 'audit_table.userRemoved',
        defaultMessage: 'Removed {username} to the {channelName} channel/group'
    },
    attemptedRegisterApp: {
        id: 'audit_table.attemptedRegisterApp',
        defaultMessage: 'Attempted to register a new OAuth Application with ID {id}'
    },
    attemptedAllowOAuthAccess: {
        id: 'audit_table.attemptedAllowOAuthAccess',
        defaultMessage: 'Attempted to allow a new OAuth service access'
    },
    successfullOAuthAccess: {
        id: 'audit_table.successfullOAuthAccess',
        defaultMessage: 'Successfully gave a new OAuth service access'
    },
    failedOAuthAccess: {
        id: 'audit_table.failedOAuthAccess',
        defaultMessage: 'Failed to allow a new OAuth service access - the redirect URI did not match the previously registered callback'
    },
    attemptedOAuthToken: {
        id: 'audit_table.attemptedOAuthToken',
        defaultMessage: 'Attempted to get an OAuth access token'
    },
    successfullOAuthToken: {
        id: 'audit_table.successfullOAuthToken',
        defaultMessage: 'Successfully added a new OAuth service'
    },
    oauthTokenFailed: {
        id: 'audit_table.oauthTokenFailed',
        defaultMessage: 'Failed to get an OAuth access token - {token}'
    },
    attemptedLogin: {
        id: 'audit_table.attemptedLogin',
        defaultMessage: 'Attempted to login'
    },
    successfullLogin: {
        id: 'audit_table.successfullLogin',
        defaultMessage: 'Successfully logged in'
    },
    failedLogin: {
        id: 'audit_table.failedLogin',
        defaultMessage: 'FAILED login attempt'
    },
    updatePicture: {
        id: 'audit_table.updatePicture',
        defaultMessage: 'Updated your profile picture'
    },
    updateGeneral: {
        id: 'audit_table.updateGeneral',
        defaultMessage: 'Updated the general settings of your account'
    },
    attemptedPassword: {
        id: 'audit_table.attemptedPassword',
        defaultMessage: 'Attempted to change password'
    },
    successfullPassword: {
        id: 'audit_table.successfullPassword',
        defaultMessage: 'Successfully changed password'
    },
    failedPassword: {
        id: 'audit_table.failedPassword',
        defaultMessage: 'Failed to change password - tried to update user password who was logged in through oauth'
    },
    updatedRol: {
        id: 'audit_table.updatedRol',
        defaultMessage: 'Updated user role(s) to '
    },
    member: {
        id: 'audit_table.member',
        defaultMessage: 'member'
    },
    accountActive: {
        id: 'audit_table.accountActive',
        defaultMessage: 'Account made active'
    },
    accountInactive: {
        id: 'audit_table.accountInactive',
        defaultMessage: 'Account made inactive'
    },
    by: {
        id: 'audit_table.by',
        defaultMessage: ' by {username}'
    },
    byAdmin: {
        id: 'audit_table.byAdmin',
        defaultMessage: ' by an admin'
    },
    sentEmail: {
        id: 'audit_table.sentEmail',
        defaultMessage: 'Sent an email to {email} to reset your password'
    },
    attemptedReset: {
        id: 'audit_table.attemptedReset',
        defaultMessage: 'Attempted to reset password'
    },
    successfullReset: {
        id: 'audit_table.successfullReset',
        defaultMessage: 'Successfully reset password'
    },
    updateGlobalNotifications: {
        id: 'audit_table.updateGlobalNotifications',
        defaultMessage: 'Updated your global notification settings'
    },
    attemptedWebhookCreate: {
        id: 'audit_table.attemptedWebhookCreate',
        defaultMessage: 'Attempted to create a webhook'
    },
    succcessfullWebhookCreate: {
        id: 'audit_table.successfullWebhookCreate',
        defaultMessage: 'Successfully created a webhook'
    },
    failedWebhookCreate: {
        id: 'audit_table.failedWebhookCreate',
        defaultMessage: 'Failed to create a webhook - bad channel permissions'
    },
    attemptedWebhookDelete: {
        id: 'audit_table.attemptedWebhookDelete',
        defaultMessage: 'Attempted to delete a webhook'
    },
    successfullWebhookDelete: {
        id: 'audit_table.successfullWebhookDelete',
        defaultMessage: 'Successfully deleted a webhook'
    },
    failedWebhookDelete: {
        id: 'audit_table.failedWebhookDelete',
        defaultMessage: 'Failed to delete a webhook - inappropriate conditions'
    },
    logout: {
        id: 'audit_table.logout',
        defaultMessage: 'Logged out of your account'
    },
    verified: {
        id: 'audit_table.verified',
        defaultMessage: 'Sucessfully verified your email address'
    },
    revokedAll: {
        id: 'audit_table.revokedAll',
        defaultMessage: 'Revoked all current sessions for the team'
    },
    loginAttempt: {
        id: 'audit_table.loginAttempt',
        defaultMessage: ' (Login attempt)'
    },
    loginFailure: {
        id: 'audit_table.loginFailure',
        defaultMessage: ' (Login failure)'
    },
    userId: {
        id: 'audit_table.userId',
        defaultMessage: 'User ID'
    }
});

class AuditTable extends React.Component {
    constructor(props) {
        super(props);

        this.handleMoreInfo = this.handleMoreInfo.bind(this);
        this.formatAuditInfo = this.formatAuditInfo.bind(this);
        this.handleRevokedSession = this.handleRevokedSession.bind(this);

        this.state = {moreInfo: []};
    }
    handleMoreInfo(index) {
        var newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
    }
    handleRevokedSession(sessionId) {
        return this.props.intl.formatMessage(holders.sessionRevoked, {sessionId: sessionId});
    }
    formatAuditInfo(currentAudit) {
        const currentActionURL = currentAudit.action.replace(/\/api\/v[1-9]/, '');

        const {formatMessage} = this.props.intl;
        let currentAuditDesc = '';

        if (currentActionURL.indexOf('/channels') === 0) {
            const channelInfo = currentAudit.extra_info.split(' ');
            const channelNameField = channelInfo[0].split('=');

            let channelURL = '';
            let channelObj;
            let channelName = '';
            if (channelNameField.indexOf('name') >= 0) {
                channelURL = channelNameField[channelNameField.indexOf('name') + 1];
                channelObj = ChannelStore.getByName(channelURL);
                if (channelObj) {
                    channelName = channelObj.display_name;
                } else {
                    channelName = channelURL;
                }
            }

            switch (currentActionURL) {
            case '/channels/create':
                currentAuditDesc = formatMessage(holders.channelCreated, {channelName: channelName});
                break;
            case '/channels/create_direct':
                currentAuditDesc = formatMessage(holders.establishedDM, {username: Utils.getDirectTeammate(channelObj.id).username});
                break;
            case '/channels/update':
                currentAuditDesc = formatMessage(holders.nameUpdated, {channelName: channelName});
                break;
            case '/channels/update_desc': // support the old path
            case '/channels/update_header':
                currentAuditDesc = formatMessage(holders.headerUpdated, {channelName: channelName});
                break;
            default: {
                let userIdField = [];
                let userId = '';
                let username = '';

                if (channelInfo[1]) {
                    userIdField = channelInfo[1].split('=');

                    if (userIdField.indexOf('user_id') >= 0) {
                        userId = userIdField[userIdField.indexOf('user_id') + 1];
                        username = UserStore.getProfile(userId).username;
                    }
                }

                if (/\/channels\/[A-Za-z0-9]+\/delete/.test(currentActionURL)) {
                    currentAuditDesc = formatMessage(holders.channelDeleted, {url: channelURL});
                } else if (/\/channels\/[A-Za-z0-9]+\/add/.test(currentActionURL)) {
                    currentAuditDesc = formatMessage(holders.userAdded, {username: username, channelName: channelName});
                } else if (/\/channels\/[A-Za-z0-9]+\/remove/.test(currentActionURL)) {
                    currentAuditDesc = formatMessage(holders.userRemoved, {username: username, channelName: channelName});
                }

                break;
            }
            }
        } else if (currentActionURL.indexOf('/oauth') === 0) {
            const oauthInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/oauth/register': {
                const clientIdField = oauthInfo[0].split('=');

                if (clientIdField[0] === 'client_id') {
                    currentAuditDesc = formatMessage(holders.attemptedRegisterApp, {id: clientIdField[1]});
                }

                break;
            }
            case '/oauth/allow':
                if (oauthInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedAllowOAuthAccess);
                } else if (oauthInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullOAuthAccess);
                } else if (oauthInfo[0] === 'fail - redirect_uri did not match registered callback') {
                    currentAuditDesc = formatMessage(holders.failedOAuthAccess);
                }

                break;
            case '/oauth/access_token':
                if (oauthInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedOAuthToken);
                } else if (oauthInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullOAuthToken);
                } else {
                    const oauthTokenFailure = oauthInfo[0].split('-');

                    if (oauthTokenFailure[0].trim() === 'fail' && oauthTokenFailure[1]) {
                        currentAuditDesc = formatMessage(oauthTokenFailure, {token: oauthTokenFailure[1].trim()});
                    }
                }

                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/users') === 0) {
            const userInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/users/login':
                if (userInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedLogin);
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullLogin);
                } else if (userInfo[0]) {
                    currentAuditDesc = formatMessage(holders.failedLogin);
                }

                break;
            case '/users/revoke_session':
                currentAuditDesc = this.handleRevokedSession(userInfo[0].split('=')[1]);
                break;
            case '/users/newimage':
                currentAuditDesc = formatMessage(holders.updatePicture);
                break;
            case '/users/update':
                currentAuditDesc = formatMessage(holders.updateGeneral);
                break;
            case '/users/newpassword':
                if (userInfo[0] === 'attempted') {
                    currentAuditDesc = formatMessage(holders.attemptedPassword);
                } else if (userInfo[0] === 'completed') {
                    currentAuditDesc = formatMessage(holders.successfullPassword);
                } else if (userInfo[0] === 'failed - tried to update user password who was logged in through oauth') {
                    currentAuditDesc = formatMessage(holders.failedPassword);
                }

                break;
            case '/users/update_roles': {
                const userRoles = userInfo[0].split('=')[1];

                currentAuditDesc = formatMessage(holders.updatedRol);
                if (userRoles.trim()) {
                    currentAuditDesc += userRoles;
                } else {
                    currentAuditDesc += formatMessage(holders.member);
                }

                break;
            }
            case '/users/update_active': {
                const updateType = userInfo[0].split('=')[0];
                const updateField = userInfo[0].split('=')[1];

                /* Either describes account activation/deactivation or a revoked session as part of an account deactivation */
                if (updateType === 'active') {
                    if (updateField === 'true') {
                        currentAuditDesc = formatMessage(holders.accountActive);
                    } else if (updateField === 'false') {
                        currentAuditDesc = formatMessage(holders.accountInactive);
                    }

                    const actingUserInfo = userInfo[1].split('=');
                    if (actingUserInfo[0] === 'session_user') {
                        const actingUser = UserStore.getProfile(actingUserInfo[1]);
                        const currentUser = UserStore.getCurrentUser();
                        if (currentUser && actingUser && (Utils.isAdmin(currentUser.roles) || Utils.isSystemAdmin(currentUser.roles))) {
                            currentAuditDesc += formatMessage(holders.by, {username: actingUser.username});
                        } else if (currentUser && actingUser) {
                            currentAuditDesc += formatMessage(holders.byAdmin);
                        }
                    }
                } else if (updateType === 'session_id') {
                    currentAuditDesc = this.handleRevokedSession(updateField);
                }

                break;
            }
            case '/users/send_password_reset':
                currentAuditDesc = formatMessage(holders.sentEmail, {email: userInfo[0].split('=')[1]});
                break;
            case '/users/reset_password':
                if (userInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedReset);
                } else if (userInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullReset);
                }

                break;
            case '/users/update_notify':
                currentAuditDesc = formatMessage(holders.updateGlobalNotifications);
                break;
            default:
                break;
            }
        } else if (currentActionURL.indexOf('/hooks') === 0) {
            const webhookInfo = currentAudit.extra_info.split(' ');

            switch (currentActionURL) {
            case '/hooks/incoming/create':
                if (webhookInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedWebhookCreate);
                } else if (webhookInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.succcessfullWebhookCreate);
                } else if (webhookInfo[0] === 'fail - bad channel permissions') {
                    currentAuditDesc = formatMessage(holders.failedWebhookCreate);
                }

                break;
            case '/hooks/incoming/delete':
                if (webhookInfo[0] === 'attempt') {
                    currentAuditDesc = formatMessage(holders.attemptedWebhookDelete);
                } else if (webhookInfo[0] === 'success') {
                    currentAuditDesc = formatMessage(holders.successfullWebhookDelete);
                } else if (webhookInfo[0] === 'fail - inappropriate conditions') {
                    currentAuditDesc = formatMessage(holders.failedWebhookDelete);
                }

                break;
            default:
                break;
            }
        } else {
            switch (currentActionURL) {
            case '/logout':
                currentAuditDesc = formatMessage(holders.logout);
                break;
            case '/verify_email':
                currentAuditDesc = formatMessage(holders.verified);
                break;
            default:
                break;
            }
        }

        /* If all else fails... */
        if (!currentAuditDesc) {
            /* Currently not called anywhere */
            if (currentAudit.extra_info.indexOf('revoked_all=') >= 0) {
                currentAuditDesc = formatMessage(holders.revokedAll);
            } else {
                let currentActionDesc = '';
                if (currentActionURL && currentActionURL.lastIndexOf('/') !== -1) {
                    currentActionDesc = currentActionURL.substring(currentActionURL.lastIndexOf('/') + 1).replace('_', ' ');
                    currentActionDesc = Utils.toTitleCase(currentActionDesc);
                }

                let currentExtraInfoDesc = '';
                if (currentAudit.extra_info) {
                    currentExtraInfoDesc = currentAudit.extra_info;

                    if (currentExtraInfoDesc.indexOf('=') !== -1) {
                        currentExtraInfoDesc = currentExtraInfoDesc.substring(currentExtraInfoDesc.indexOf('=') + 1);
                    }
                }
                currentAuditDesc = currentActionDesc + ' ' + currentExtraInfoDesc;
            }
        }

        const currentDate = new Date(currentAudit.create_at);
        let currentAuditInfo = currentDate.toLocaleDateString(global.window.mm_locale, {month: 'short', day: '2-digit', year: 'numeric'}) + ' - ' + currentDate.toLocaleTimeString(global.window.mm_locale, {hour: '2-digit', minute: '2-digit'});

        if (this.props.showUserId) {
            currentAuditInfo += ' | ' + formatMessage(holders.userId) + ': ' + currentAudit.user_id;
        }

        currentAuditInfo += ' | ' + currentAuditDesc;

        return currentAuditInfo;
    }
    render() {
        var accessList = [];

        const {formatMessage} = this.props.intl;
        for (var i = 0; i < this.props.audits.length; i++) {
            const currentAudit = this.props.audits[i];
            const currentAuditInfo = this.formatAuditInfo(currentAudit);

            let moreInfo;
            if (!this.props.oneLine) {
                moreInfo = (
                    <a
                        href='#'
                        className='theme'
                        onClick={this.handleMoreInfo.bind(this, i)}
                    >
                        <FormattedMessage
                            id='audit_table.moreInfo'
                            defaultMessage='More info'
                        />
                    </a>
                );
            }

            if (this.state.moreInfo[i]) {
                if (!currentAudit.session_id) {
                    currentAudit.session_id = 'N/A';

                    if (currentAudit.action.search('/users/login') >= 0) {
                        if (currentAudit.extra_info === 'attempt') {
                            currentAudit.session_id += formatMessage(holders.loginAttempt);
                        } else {
                            currentAudit.session_id += formatMessage(holders.loginFailure);
                        }
                    }
                }

                moreInfo = (
                    <div>
                        <div>
                            <FormattedMessage
                                id='audit_table.ip'
                                defaultMessage='IP: {ip}'
                                values={{
                                    ip: currentAudit.ip_address
                                }}
                            />
                        </div>
                        <div>
                            <FormattedMessage
                                id='audit_table.session'
                                defaultMessage='Session ID: {id}'
                                values={{
                                    id: currentAudit.session_id
                                }}
                            />
                        </div>
                    </div>
                );
            }

            var divider = null;
            if (i < this.props.audits.length - 1) {
                divider = (<div className='divider-light'></div>);
            }

            accessList[i] = (
                <div
                    key={'accessHistoryEntryKey' + i}
                    className='access-history__table'
                >
                    <div className='access__report'>
                        <div className='report__time'>{currentAuditInfo}</div>
                        <div className='report__info'>
                            {moreInfo}
                        </div>
                        {divider}
                    </div>
                </div>
            );
        }

        return <form role='form'>{accessList}</form>;
    }
}

AuditTable.propTypes = {
    intl: intlShape.isRequired,
    audits: React.PropTypes.array.isRequired,
    oneLine: React.PropTypes.bool,
    showUserId: React.PropTypes.bool
};

export default injectIntl(AuditTable);
