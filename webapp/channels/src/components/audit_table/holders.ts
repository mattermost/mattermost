// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

import {t} from 'utils/i18n';

const holders = defineMessages({
    sessionRevoked: {
        id: t('audit_table.sessionRevoked'),
        defaultMessage: 'The session with id {sessionId} was revoked',
    },
    channelCreated: {
        id: t('audit_table.channelCreated'),
        defaultMessage: 'Created the {channelName} channel',
    },
    establishedDM: {
        id: t('audit_table.establishedDM'),
        defaultMessage: 'Established a direct message channel with {username}',
    },
    nameUpdated: {
        id: t('audit_table.nameUpdated'),
        defaultMessage: 'Updated the {channelName} channel name',
    },
    headerUpdated: {
        id: t('audit_table.headerUpdated'),
        defaultMessage: 'Updated the {channelName} channel header',
    },
    channelDeleted: {
        id: t('audit_table.channelDeleted'),
        defaultMessage: 'Archived the channel with the URL {url}',
    },
    userAdded: {
        id: t('audit_table.userAdded'),
        defaultMessage: 'Added {username} to the {channelName} channel',
    },
    userRemoved: {
        id: t('audit_table.userRemoved'),
        defaultMessage: 'Removed {username} to the {channelName} channel',
    },
    attemptedRegisterApp: {
        id: t('audit_table.attemptedRegisterApp'),
        defaultMessage: 'Attempted to register a new OAuth Application with ID {id}',
    },
    attemptedAllowOAuthAccess: {
        id: t('audit_table.attemptedAllowOAuthAccess'),
        defaultMessage: 'Attempted to allow a new OAuth service access',
    },
    successfullOAuthAccess: {
        id: t('audit_table.successfullOAuthAccess'),
        defaultMessage: 'Successfully gave a new OAuth service access',
    },
    failedOAuthAccess: {
        id: t('audit_table.failedOAuthAccess'),
        defaultMessage: 'Failed to allow a new OAuth service access - the redirect URI did not match the previously registered callback',
    },
    attemptedOAuthToken: {
        id: t('audit_table.attemptedOAuthToken'),
        defaultMessage: 'Attempted to get an OAuth access token',
    },
    successfullOAuthToken: {
        id: t('audit_table.successfullOAuthToken'),
        defaultMessage: 'Successfully added a new OAuth service',
    },
    oauthTokenFailed: {
        id: t('audit_table.oauthTokenFailed'),
        defaultMessage: 'Failed to get an OAuth access token - {token}',
    },
    attemptedLogin: {
        id: t('audit_table.attemptedLogin'),
        defaultMessage: 'Attempted to login',
    },
    authenticated: {
        id: t('audit_table.authenticated'),
        defaultMessage: 'Successfully authenticated',
    },
    successfullLogin: {
        id: t('audit_table.successfullLogin'),
        defaultMessage: 'Successfully logged in',
    },
    failedLogin: {
        id: t('audit_table.failedLogin'),
        defaultMessage: 'FAILED login attempt',
    },
    updatePicture: {
        id: t('audit_table.updatePicture'),
        defaultMessage: 'Updated your profile picture',
    },
    updateGeneral: {
        id: t('audit_table.updateGeneral'),
        defaultMessage: 'Updated the general settings of your account',
    },
    attemptedPassword: {
        id: t('audit_table.attemptedPassword'),
        defaultMessage: 'Attempted to change password',
    },
    successfullPassword: {
        id: t('audit_table.successfullPassword'),
        defaultMessage: 'Successfully changed password',
    },
    failedPassword: {
        id: t('audit_table.failedPassword'),
        defaultMessage: 'Failed to change password - tried to update user password who was logged in through OAuth',
    },
    updatedRol: {
        id: t('audit_table.updatedRol'),
        defaultMessage: 'Updated user role(s) to ',
    },
    member: {
        id: t('audit_table.member'),
        defaultMessage: 'member',
    },
    accountActive: {
        id: t('audit_table.accountActive'),
        defaultMessage: 'Account activated',
    },
    accountInactive: {
        id: t('audit_table.accountInactive'),
        defaultMessage: 'Account deactivated',
    },
    by: {
        id: t('audit_table.by'),
        defaultMessage: ' by {username}',
    },
    byAdmin: {
        id: t('audit_table.byAdmin'),
        defaultMessage: ' by an admin',
    },
    sentEmail: {
        id: t('audit_table.sentEmail'),
        defaultMessage: 'Sent an email to {email} to reset your password',
    },
    attemptedReset: {
        id: t('audit_table.attemptedReset'),
        defaultMessage: 'Attempted to reset password',
    },
    successfullReset: {
        id: t('audit_table.successfullReset'),
        defaultMessage: 'Successfully reset password',
    },
    updateGlobalNotifications: {
        id: t('audit_table.updateGlobalNotifications'),
        defaultMessage: 'Updated your global notification settings',
    },
    attemptedWebhookCreate: {
        id: t('audit_table.attemptedWebhookCreate'),
        defaultMessage: 'Attempted to create a webhook',
    },
    succcessfullWebhookCreate: {
        id: t('audit_table.successfullWebhookCreate'),
        defaultMessage: 'Successfully created a webhook',
    },
    failedWebhookCreate: {
        id: t('audit_table.failedWebhookCreate'),
        defaultMessage: 'Failed to create a webhook - bad channel permissions',
    },
    attemptedWebhookDelete: {
        id: t('audit_table.attemptedWebhookDelete'),
        defaultMessage: 'Attempted to delete a webhook',
    },
    successfullWebhookDelete: {
        id: t('audit_table.successfullWebhookDelete'),
        defaultMessage: 'Successfully deleted a webhook',
    },
    failedWebhookDelete: {
        id: t('audit_table.failedWebhookDelete'),
        defaultMessage: 'Failed to delete a webhook - inappropriate conditions',
    },
    logout: {
        id: t('audit_table.logout'),
        defaultMessage: 'Logged out of your account',
    },
    verified: {
        id: t('audit_table.verified'),
        defaultMessage: 'Successfully verified your email address',
    },
    revokedAll: {
        id: t('audit_table.revokedAll'),
        defaultMessage: 'Revoked all current sessions for the team',
    },
    loginAttempt: {
        id: t('audit_table.loginAttempt'),
        defaultMessage: ' (Login attempt)',
    },
    loginFailure: {
        id: t('audit_table.loginFailure'),
        defaultMessage: ' (Login failure)',
    },
    attemptedLicenseAdd: {
        id: t('audit_table.attemptedLicenseAdd'),
        defaultMessage: 'Attempted to add new license',
    },
    successfullLicenseAdd: {
        id: t('audit_table.successfullLicenseAdd'),
        defaultMessage: 'Successfully added new license',
    },
    failedExpiredLicenseAdd: {
        id: t('audit_table.failedExpiredLicenseAdd'),
        defaultMessage: 'Failed to add a new license as it has either expired or not yet been started',
    },
    failedInvalidLicenseAdd: {
        id: t('audit_table.failedInvalidLicenseAdd'),
        defaultMessage: 'Failed to add an invalid license',
    },
    licenseRemoved: {
        id: t('audit_table.licenseRemoved'),
        defaultMessage: 'Successfully removed a license',
    },
});

export default holders;
