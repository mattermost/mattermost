// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export const messages = defineMessages({
    title: {id: 'admin.sessionLengths.title', defaultMessage: 'Session Lengths'},
    webSessionHoursDesc_extendLength: {id: 'admin.service.webSessionHoursDesc.extendLength', defaultMessage: "Set the number of hours from the last activity in Mattermost to the expiry of the user's session when using email and AD/LDAP authentication. After changing this setting, the new session length will take effect after the next time the user enters their credentials."},
    mobileSessionHoursDesc_extendLength: {id: 'admin.service.mobileSessionHoursDesc.extendLength', defaultMessage: "Set the number of hours from the last activity in Mattermost to the expiry of the user's session on mobile. After changing this setting, the new session length will take effect after the next time the user enters their credentials."},
    ssoSessionHoursDesc_extendLength: {id: 'admin.service.ssoSessionHoursDesc.extendLength', defaultMessage: "Set the number of hours from the last activity in Mattermost to the expiry of the user's session for SSO authentication, such as SAML, GitLab and OAuth 2.0. If the authentication method is SAML or GitLab, the user may automatically be logged back in to Mattermost if they are already logged in to SAML or GitLab. After changing this setting, the setting will take effect after the next time the user enters their credentials."},
    webSessionHoursDesc: {id: 'admin.service.webSessionHoursDesc', defaultMessage: "The number of hours from the last time a user entered their credentials to the expiry of the user's session. After changing this setting, the new session length will take effect after the next time the user enters their credentials."},
    mobileSessionHoursDesc: {id: 'admin.service.mobileSessionHoursDesc', defaultMessage: "The number of hours from the last time a user entered their credentials to the expiry of the user's session. After changing this setting, the new session length will take effect after the next time the user enters their credentials."},
    ssoSessionHoursDesc: {id: 'admin.service.ssoSessionHoursDesc', defaultMessage: "The number of hours from the last time a user entered their credentials to the expiry of the user's session. If the authentication method is SAML or GitLab, the user may automatically be logged back in to Mattermost if they are already logged in to SAML or GitLab. After changing this setting, the setting will take effect after the next time the user enters their credentials."},
    sessionIdleTimeout: {id: 'admin.service.sessionIdleTimeout', defaultMessage: 'Session Idle Timeout (minutes):'},
    extendSessionLengthActivity_label: {id: 'admin.service.extendSessionLengthActivity.label', defaultMessage: 'Extend session length with activity: '},
    extendSessionLengthActivity_helpText: {id: 'admin.service.extendSessionLengthActivity.helpText', defaultMessage: 'When true, sessions will be automatically extended when the user is active in their Mattermost client. Users sessions will only expire if they are not active in their Mattermost client for the entire duration of the session lengths defined in the fields below. When false, sessions will not extend with activity in Mattermost. User sessions will immediately expire at the end of the session length or idle timeouts defined below. '},
    terminateSessionsOnPasswordChange_label: {id: 'admin.service.terminateSessionsOnPasswordChange.label', defaultMessage: 'Terminate Sessions on Password Change: '},
    terminateSessionsOnPasswordChange_helpText: {id: 'admin.service.terminateSessionsOnPasswordChange.helpText', defaultMessage: 'When true, all sessions of a user will expire if their password is changed by themselves or an administrator.'},
    webSessionHours: {id: 'admin.service.webSessionHours', defaultMessage: 'Session Length AD/LDAP and Email (hours):'},
    mobileSessionHours: {id: 'admin.service.mobileSessionHours', defaultMessage: 'Session Length Mobile (hours):'},
    ssoSessionHours: {id: 'admin.service.ssoSessionHours', defaultMessage: 'Session Length SSO (hours):'},
    sessionCache: {id: 'admin.service.sessionCache', defaultMessage: 'Session Cache (minutes):'},
    sessionCacheDesc: {id: 'admin.service.sessionCacheDesc', defaultMessage: 'The number of minutes to cache a session in memory:'},
    sessionHoursEx: {id: 'admin.service.sessionHoursEx', defaultMessage: 'E.g.: "720"'},
    sessionIdleTimeoutDesc: {id: 'admin.service.sessionIdleTimeoutDesc', defaultMessage: "The number of minutes from the last time a user was active on the system to the expiry of the user's session. Once expired, the user will need to log in to continue. Minimum is 5 minutes, and 0 is unlimited. Applies to the desktop app and browsers. For mobile apps, use an EMM provider to lock the app when not in use. In High Availability mode, enable IP hash load balancing for reliable timeout measurement."},
});

export const searchableStrings = [
    messages.title,
    messages.webSessionHoursDesc_extendLength,
    messages.mobileSessionHoursDesc_extendLength,
    messages.ssoSessionHoursDesc_extendLength,
    messages.webSessionHoursDesc,
    messages.mobileSessionHoursDesc,
    messages.ssoSessionHoursDesc,
    messages.sessionIdleTimeout,
    messages.extendSessionLengthActivity_label,
    messages.extendSessionLengthActivity_helpText,
    messages.webSessionHours,
    messages.mobileSessionHours,
    messages.ssoSessionHours,
    messages.sessionCache,
    messages.sessionCacheDesc,
    messages.sessionHoursEx,
    messages.sessionIdleTimeoutDesc,
];
