// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import * as Utils from '../utils/utils.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedDate, FormattedTime} from 'mm-intl';

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
    attemptedLicenseAdd: {
        id: 'audit_table.attemptedLicenseAdd',
        defaultMessage: 'Attempted to add new license'
    },
    successfullLicenseAdd: {
        id: 'audit_table.successfullLicenseAdd',
        defaultMessage: 'Successfully added new license'
    },
    failedExpiredLicenseAdd: {
        id: 'audit_table.failedExpiredLicenseAdd',
        defaultMessage: 'Failed to add a new license as it has either expired or not yet been started'
    },
    failedInvalidLicenseAdd: {
        id: 'audit_table.failedInvalidLicenseAdd',
        defaultMessage: 'Failed to add an invalid license'
    },
    licenseRemoved: {
        id: 'audit_table.licenseRemoved',
        defaultMessage: 'Successfully removed a license'
    }
});

class AuditTable extends React.Component {
    render() {
        var accessList = [];

        const {formatMessage} = this.props.intl;
        for (var i = 0; i < this.props.audits.length; i++) {
            const audit = this.props.audits[i];
            const auditInfo = formatAuditInfo(audit, formatMessage);

            let uContent;
            if (this.props.showUserId) {
                uContent = <td>{auditInfo.userId}</td>;
            }

            let iContent;
            if (this.props.showIp) {
                iContent = <td>{auditInfo.ip}</td>;
            }

            let sContent;
            if (this.props.showSession) {
                sContent = <td>{auditInfo.sessionId}</td>;
            }

            let descStyle = {};
            if (auditInfo.desc.toLowerCase().indexOf('fail') !== -1) {
                descStyle.color = 'red';
            }

            accessList[i] = (
                <tr key={audit.id}>
                    <td>{auditInfo.timestamp}</td>
                    {uContent}
                    <td style={descStyle}>{auditInfo.desc}</td>
                    {iContent}
                    {sContent}
                </tr>
            );
        }

        let userIdContent;
        if (this.props.showUserId) {
            userIdContent = (
                <th>
                    <FormattedMessage
                        id='audit_table.userId'
                        defaultMessage='User ID'
                    />
                </th>
            );
        }

        let ipContent;
        if (this.props.showIp) {
            ipContent = (
                <th>
                    <FormattedMessage
                        id='audit_table.ip'
                        defaultMessage='IP Address'
                    />
                </th>
            );
        }

        let sessionContent;
        if (this.props.showSession) {
            sessionContent = (
                <th>
                    <FormattedMessage
                        id='audit_table.session'
                        defaultMessage='Session ID'
                    />
                </th>
            );
        }

        return (
            <table className='table'>
                <thead>
                    <tr>
                        <th>
                            <FormattedMessage
                                id='audit_table.timestamp'
                                defaultMessage='Timestamp'
                            />
                        </th>
                        {userIdContent}
                        <th>
                            <FormattedMessage
                                id='audit_table.action'
                                defaultMessage='Action'
                            />
                        </th>
                        {ipContent}
                        {sessionContent}
                    </tr>
                </thead>
                <tbody>
                    {accessList}
                </tbody>
            </table>
        );
    }
}

AuditTable.propTypes = {
    intl: intlShape.isRequired,
    audits: React.PropTypes.array.isRequired,
    showUserId: React.PropTypes.bool,
    showIp: React.PropTypes.bool,
    showSession: React.PropTypes.bool
};

export default injectIntl(AuditTable);

export function formatAuditInfo(audit, formatMessage) {
    const actionURL = audit.action.replace(/\/api\/v[1-9]/, '');
    let auditDesc = '';

    if (actionURL.indexOf('/channels') === 0) {
        const channelInfo = audit.extra_info.split(' ');
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

        switch (actionURL) {
        case '/channels/create':
            auditDesc = formatMessage(holders.channelCreated, {channelName});
            break;
        case '/channels/create_direct':
            auditDesc = formatMessage(holders.establishedDM, {username: Utils.getDirectTeammate(channelObj.id).username});
            break;
        case '/channels/update':
            auditDesc = formatMessage(holders.nameUpdated, {channelName});
            break;
        case '/channels/update_desc': // support the old path
        case '/channels/update_header':
            auditDesc = formatMessage(holders.headerUpdated, {channelName});
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

            if (/\/channels\/[A-Za-z0-9]+\/delete/.test(actionURL)) {
                auditDesc = formatMessage(holders.channelDeleted, {url: channelURL});
            } else if (/\/channels\/[A-Za-z0-9]+\/add/.test(actionURL)) {
                auditDesc = formatMessage(holders.userAdded, {username, channelName});
            } else if (/\/channels\/[A-Za-z0-9]+\/remove/.test(actionURL)) {
                auditDesc = formatMessage(holders.userRemoved, {username, channelName});
            }

            break;
        }
        }
    } else if (actionURL.indexOf('/oauth') === 0) {
        const oauthInfo = audit.extra_info.split(' ');

        switch (actionURL) {
        case '/oauth/register': {
            const clientIdField = oauthInfo[0].split('=');

            if (clientIdField[0] === 'client_id') {
                auditDesc = formatMessage(holders.attemptedRegisterApp, {id: clientIdField[1]});
            }

            break;
        }
        case '/oauth/allow':
            if (oauthInfo[0] === 'attempt') {
                auditDesc = formatMessage(holders.attemptedAllowOAuthAccess);
            } else if (oauthInfo[0] === 'success') {
                auditDesc = formatMessage(holders.successfullOAuthAccess);
            } else if (oauthInfo[0] === 'fail - redirect_uri did not match registered callback') {
                auditDesc = formatMessage(holders.failedOAuthAccess);
            }

            break;
        case '/oauth/access_token':
            if (oauthInfo[0] === 'attempt') {
                auditDesc = formatMessage(holders.attemptedOAuthToken);
            } else if (oauthInfo[0] === 'success') {
                auditDesc = formatMessage(holders.successfullOAuthToken);
            } else {
                const oauthTokenFailure = oauthInfo[0].split('-');

                if (oauthTokenFailure[0].trim() === 'fail' && oauthTokenFailure[1]) {
                    auditDesc = formatMessage(oauthTokenFailure, {token: oauthTokenFailure[1].trim()});
                }
            }

            break;
        default:
            break;
        }
    } else if (actionURL.indexOf('/users') === 0) {
        const userInfo = audit.extra_info.split(' ');

        switch (actionURL) {
        case '/users/login':
            if (userInfo[0] === 'attempt') {
                auditDesc = formatMessage(holders.attemptedLogin);
            } else if (userInfo[0] === 'success') {
                auditDesc = formatMessage(holders.successfullLogin);
            } else if (userInfo[0]) {
                auditDesc = formatMessage(holders.failedLogin);
            }

            break;
        case '/users/revoke_session':
            auditDesc = formatMessage(holders.sessionRevoked, {sessionId: userInfo[0].split('=')[1]});
            break;
        case '/users/newimage':
            auditDesc = formatMessage(holders.updatePicture);
            break;
        case '/users/update':
            auditDesc = formatMessage(holders.updateGeneral);
            break;
        case '/users/newpassword':
            if (userInfo[0] === 'attempted') {
                auditDesc = formatMessage(holders.attemptedPassword);
            } else if (userInfo[0] === 'completed') {
                auditDesc = formatMessage(holders.successfullPassword);
            } else if (userInfo[0] === 'failed - tried to update user password who was logged in through oauth') {
                auditDesc = formatMessage(holders.failedPassword);
            }

            break;
        case '/users/update_roles': {
            const userRoles = userInfo[0].split('=')[1];

            auditDesc = formatMessage(holders.updatedRol);
            if (userRoles.trim()) {
                auditDesc += userRoles;
            } else {
                auditDesc += formatMessage(holders.member);
            }

            break;
        }
        case '/users/update_active': {
            const updateType = userInfo[0].split('=')[0];
            const updateField = userInfo[0].split('=')[1];

            /* Either describes account activation/deactivation or a revoked session as part of an account deactivation */
            if (updateType === 'active') {
                if (updateField === 'true') {
                    auditDesc = formatMessage(holders.accountActive);
                } else if (updateField === 'false') {
                    auditDesc = formatMessage(holders.accountInactive);
                }

                const actingUserInfo = userInfo[1].split('=');
                if (actingUserInfo[0] === 'session_user') {
                    const actingUser = UserStore.getProfile(actingUserInfo[1]);
                    const user = UserStore.getCurrentUser();
                    if (user && actingUser && (Utils.isAdmin(user.roles) || Utils.isSystemAdmin(user.roles))) {
                        auditDesc += formatMessage(holders.by, {username: actingUser.username});
                    } else if (user && actingUser) {
                        auditDesc += formatMessage(holders.byAdmin);
                    }
                }
            } else if (updateType === 'session_id') {
                auditDesc = formatMessage(holders.sessionRevoked, {sessionId: updateField});
            }

            break;
        }
        case '/users/send_password_reset':
            auditDesc = formatMessage(holders.sentEmail, {email: userInfo[0].split('=')[1]});
            break;
        case '/users/reset_password':
            if (userInfo[0] === 'attempt') {
                auditDesc = formatMessage(holders.attemptedReset);
            } else if (userInfo[0] === 'success') {
                auditDesc = formatMessage(holders.successfullReset);
            }

            break;
        case '/users/update_notify':
            auditDesc = formatMessage(holders.updateGlobalNotifications);
            break;
        default:
            break;
        }
    } else if (actionURL.indexOf('/hooks') === 0) {
        const webhookInfo = audit.extra_info;

        switch (actionURL) {
        case '/hooks/incoming/create':
            if (webhookInfo === 'attempt') {
                auditDesc = formatMessage(holders.attemptedWebhookCreate);
            } else if (webhookInfo === 'success') {
                auditDesc = formatMessage(holders.succcessfullWebhookCreate);
            } else if (webhookInfo === 'fail - bad channel permissions') {
                auditDesc = formatMessage(holders.failedWebhookCreate);
            }

            break;
        case '/hooks/incoming/delete':
            if (webhookInfo === 'attempt') {
                auditDesc = formatMessage(holders.attemptedWebhookDelete);
            } else if (webhookInfo === 'success') {
                auditDesc = formatMessage(holders.successfullWebhookDelete);
            } else if (webhookInfo === 'fail - inappropriate conditions') {
                auditDesc = formatMessage(holders.failedWebhookDelete);
            }

            break;
        default:
            break;
        }
    } else if (actionURL.indexOf('/license') === 0) {
        const licenseInfo = audit.extra_info;

        switch (actionURL) {
        case '/license/add':
            if (licenseInfo === 'attempt') {
                auditDesc = formatMessage(holders.attemptedLicenseAdd);
            } else if (licenseInfo === 'success') {
                auditDesc = formatMessage(holders.successfullLicenseAdd);
            } else if (licenseInfo === 'failed - expired or non-started license') {
                auditDesc = formatMessage(holders.failedExpiredLicenseAdd);
            } else if (licenseInfo === 'failed - invalid license') {
                auditDesc = formatMessage(holders.failedInvalidLicenseAdd);
            }

            break;
        case '/license/remove':
            auditDesc = formatMessage(holders.licenseRemoved);
            break;
        default:
            break;
        }
    } else {
        switch (actionURL) {
        case '/logout':
            auditDesc = formatMessage(holders.logout);
            break;
        case '/verify_email':
            auditDesc = formatMessage(holders.verified);
            break;
        default:
            break;
        }
    }

    /* If all else fails... */
    if (!auditDesc) {
        /* Currently not called anywhere */
        if (audit.extra_info.indexOf('revoked_all=') >= 0) {
            auditDesc = formatMessage(holders.revokedAll);
        } else {
            let actionDesc = '';
            if (actionURL && actionURL.lastIndexOf('/') !== -1) {
                actionDesc = actionURL.substring(actionURL.lastIndexOf('/') + 1).replace('_', ' ');
                actionDesc = Utils.toTitleCase(actionDesc);
            }

            let extraInfoDesc = '';
            if (audit.extra_info) {
                extraInfoDesc = audit.extra_info;

                if (extraInfoDesc.indexOf('=') !== -1) {
                    extraInfoDesc = extraInfoDesc.substring(extraInfoDesc.indexOf('=') + 1);
                }
            }
            auditDesc = actionDesc + ' ' + extraInfoDesc;
        }
    }

    const date = new Date(audit.create_at);
    const auditInfo = {};
    auditInfo.timestamp = (
        <div>
            <FormattedDate
                value={date}
                day='2-digit'
                month='short'
                year='numeric'
            />
            {' - '}
            <FormattedTime
                value={date}
                hour='2-digit'
                minute='2-digit'
            />
        </div>
    );
    auditInfo.userId = audit.user_id;
    auditInfo.desc = auditDesc;
    auditInfo.ip = audit.ip_address;
    auditInfo.sessionId = audit.session_id;

    return auditInfo;
}
