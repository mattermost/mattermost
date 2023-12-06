// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

const holders = defineMessages({
    sessionRevoked: {
        id: 'audit_table.sessionRevoked',
        defaultMessage: 'The session with id {sessionId} was revoked',
    },
    channelCreated: {
        id: 'audit_table.channelCreated',
        defaultMessage: 'Created the {channelName} channel',
    },
    establishedDM: {
        id: 'audit_table.establishedDM',
        defaultMessage: 'Established a direct message channel with {username}',
    },
    nameUpdated: {
        id: 'audit_table.nameUpdated',
        defaultMessage: 'Updated the {channelName} channel name',
    },
    headerUpdated: {
        id: 'audit_table.headerUpdated',
        defaultMessage: 'Updated the {channelName} channel header',
    },
    channelDeleted: {
        id: 'audit_table.channelDeleted',
        defaultMessage: 'Archived the channel with the URL {url}',
    },
    userAdded: {
        id: 'audit_table.userAdded',
        defaultMessage: 'Added {username} to the {channelName} channel',
    },
    userRemoved: {
        id: 'audit_table.userRemoved',
        defaultMessage: 'Removed {username} to the {channelName} channel',
    },
    attemptedRegisterApp: {
        id: 'audit_table.attemptedRegisterApp',
        defaultMessage: 'Attempted to register a new OAuth Application with ID {id}',
    },
    attemptedAllowOAuthAccess: {
        id: 'audit_table.attemptedAllowOAuthAccess',
        defaultMessage: 'Attempted to allow a new OAuth service access',
    },
    successfullOAuthAccess: {
        id: 'audit_table.successfullOAuthAccess',
        defaultMessage: 'Successfully gave a new OAuth service access',
    },
    failedOAuthAccess: {
        id: 'audit_table.failedOAuthAccess',
        defaultMessage: 'Failed to allow a new OAuth service access - the redirect URI did not match the previously registered callback',
    },
    attemptedOAuthToken: {
        id: 'audit_table.attemptedOAuthToken',
        defaultMessage: 'Attempted to get an OAuth access token',
    },
    successfullOAuthToken: {
        id: 'audit_table.successfullOAuthToken',
        defaultMessage: 'Successfully added a new OAuth service',
    },
    oauthTokenFailed: {
        id: 'audit_table.oauthTokenFailed',
        defaultMessage: 'Failed to get an OAuth access token - {token}',
    },
    attemptedLogin: {
        id: 'audit_table.attemptedLogin',
        defaultMessage: 'Attempted to login',
    },
    authenticated: {
        id: 'audit_table.authenticated',
        defaultMessage: 'Successfully authenticated',
    },
    successfullLogin: {
        id: 'audit_table.successfullLogin',
        defaultMessage: 'Successfully logged in',
    },
    failedLogin: {
        id: 'audit_table.failedLogin',
        defaultMessage: 'FAILED login attempt',
    },
    updatePicture: {
        id: 'audit_table.updatePicture',
        defaultMessage: 'Updated your profile picture',
    },
    updateGeneral: {
        id: 'audit_table.updateGeneral',
        defaultMessage: 'Updated the general settings of your account',
    },
    attemptedPassword: {
        id: 'audit_table.attemptedPassword',
        defaultMessage: 'Attempted to change password',
    },
    successfullPassword: {
        id: 'audit_table.successfullPassword',
        defaultMessage: 'Successfully changed password',
    },
    failedPassword: {
        id: 'audit_table.failedPassword',
        defaultMessage: 'Failed to change password - tried to update user password who was logged in through OAuth',
    },
    updatedRol: {
        id: 'audit_table.updatedRol',
        defaultMessage: 'Updated user role(s) to ',
    },
    member: {
        id: 'audit_table.member',
        defaultMessage: 'member',
    },
    accountActive: {
        id: 'audit_table.accountActive',
        defaultMessage: 'Account activated',
    },
    accountInactive: {
        id: 'audit_table.accountInactive',
        defaultMessage: 'Account deactivated',
    },
    by: {
        id: 'audit_table.by',
        defaultMessage: ' by {username}',
    },
    byAdmin: {
        id: 'audit_table.byAdmin',
        defaultMessage: ' by an admin',
    },
    sentEmail: {
        id: 'audit_table.sentEmail',
        defaultMessage: 'Sent an email to {email} to reset your password',
    },
    attemptedReset: {
        id: 'audit_table.attemptedReset',
        defaultMessage: 'Attempted to reset password',
    },
    successfullReset: {
        id: 'audit_table.successfullReset',
        defaultMessage: 'Successfully reset password',
    },
    updateGlobalNotifications: {
        id: 'audit_table.updateGlobalNotifications',
        defaultMessage: 'Updated your global notification settings',
    },
    attemptedWebhookCreate: {
        id: 'audit_table.attemptedWebhookCreate',
        defaultMessage: 'Attempted to create a webhook',
    },
    succcessfullWebhookCreate: {
        id: 'audit_table.successfullWebhookCreate',
        defaultMessage: 'Successfully created a webhook',
    },
    failedWebhookCreate: {
        id: 'audit_table.failedWebhookCreate',
        defaultMessage: 'Failed to create a webhook - bad channel permissions',
    },
    attemptedWebhookDelete: {
        id: 'audit_table.attemptedWebhookDelete',
        defaultMessage: 'Attempted to delete a webhook',
    },
    successfullWebhookDelete: {
        id: 'audit_table.successfullWebhookDelete',
        defaultMessage: 'Successfully deleted a webhook',
    },
    failedWebhookDelete: {
        id: 'audit_table.failedWebhookDelete',
        defaultMessage: 'Failed to delete a webhook - inappropriate conditions',
    },
    logout: {
        id: 'audit_table.logout',
        defaultMessage: 'Logged out of your account',
    },
    verified: {
        id: 'audit_table.verified',
        defaultMessage: 'Successfully verified your email address',
    },
    revokedAll: {
        id: 'audit_table.revokedAll',
        defaultMessage: 'Revoked all current sessions for the team',
    },
    loginAttempt: {
        id: 'audit_table.loginAttempt',
        defaultMessage: ' (Login attempt)',
    },
    loginFailure: {
        id: 'audit_table.loginFailure',
        defaultMessage: ' (Login failure)',
    },
    attemptedLicenseAdd: {
        id: 'audit_table.attemptedLicenseAdd',
        defaultMessage: 'Attempted to add new license',
    },
    successfullLicenseAdd: {
        id: 'audit_table.successfullLicenseAdd',
        defaultMessage: 'Successfully added new license',
    },
    failedExpiredLicenseAdd: {
        id: 'audit_table.failedExpiredLicenseAdd',
        defaultMessage: 'Failed to add a new license as it has either expired or not yet been started',
    },
    failedInvalidLicenseAdd: {
        id: 'audit_table.failedInvalidLicenseAdd',
        defaultMessage: 'Failed to add an invalid license',
    },
    licenseRemoved: {
        id: 'audit_table.licenseRemoved',
        defaultMessage: 'Successfully removed a license',
    },
});

export default holders;
