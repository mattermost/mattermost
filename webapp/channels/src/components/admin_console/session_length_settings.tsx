// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage, defineMessages} from 'react-intl';

import type {AdminConfig, ClientLicense, ServiceSettings} from '@mattermost/types/config';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import AdminSettings from './admin_settings';
import type {BaseState, BaseProps} from './admin_settings';
import BooleanSetting from './boolean_setting';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

interface State extends BaseState {
    extendSessionLengthWithActivity: ServiceSettings['ExtendSessionLengthWithActivity'];
    sessionLengthWebInHours: ServiceSettings['SessionLengthWebInHours'];
    sessionLengthMobileInHours: ServiceSettings['SessionLengthMobileInHours'];
    sessionLengthSSOInHours: ServiceSettings['SessionLengthSSOInHours'];
    sessionCacheInMinutes: ServiceSettings['SessionCacheInMinutes'];
    sessionIdleTimeoutInMinutes: ServiceSettings['SessionIdleTimeoutInMinutes'];
    sessionIdleTimeoutMobileInMinutes: ClientLicense['SessionIdleTimeoutMobileInMinutes'];
}

type Props = BaseProps & {
    license: ClientLicense;
};

const messages = defineMessages({
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

export default class SessionLengthSettings extends AdminSettings<Props, State> {
    getConfigFromState = (config: AdminConfig) => {
        const MINIMUM_IDLE_TIMEOUT = 5;

        config.ServiceSettings.ExtendSessionLengthWithActivity = this.state.extendSessionLengthWithActivity;
        config.ServiceSettings.SessionLengthWebInHours = this.parseIntNonZero(this.state.sessionLengthWebInHours);
        config.ServiceSettings.SessionLengthMobileInHours = this.parseIntNonZero(this.state.sessionLengthMobileInHours);
        config.ServiceSettings.SessionLengthSSOInHours = this.parseIntNonZero(this.state.sessionLengthSSOInHours);
        config.ServiceSettings.SessionCacheInMinutes = this.parseIntNonZero(this.state.sessionCacheInMinutes);
        config.ServiceSettings.SessionIdleTimeoutInMinutes = this.parseIntZeroOrMin(this.state.sessionIdleTimeoutInMinutes, MINIMUM_IDLE_TIMEOUT);

        return config;
    };

    getStateFromConfig(config: AdminConfig) {
        return {
            extendSessionLengthWithActivity: config.ServiceSettings.ExtendSessionLengthWithActivity,
            sessionLengthWebInHours: config.ServiceSettings.SessionLengthWebInHours,
            sessionLengthMobileInHours: config.ServiceSettings.SessionLengthMobileInHours,
            sessionLengthSSOInHours: config.ServiceSettings.SessionLengthSSOInHours,
            sessionCacheInMinutes: config.ServiceSettings.SessionCacheInMinutes,
            sessionIdleTimeoutInMinutes: config.ServiceSettings.SessionIdleTimeoutInMinutes,
        };
    }

    renderTitle() {
        return (
            <FormattedMessage {...messages.title}/>
        );
    }

    renderSettings = () => {
        let sessionLengthWebHelpText;
        let sessionLengthMobileHelpText;
        let sessionLengthSSOHelpText;
        let sessionTimeoutSetting;
        if (this.state.extendSessionLengthWithActivity) {
            sessionLengthWebHelpText = (<FormattedMessage {...messages.webSessionHoursDesc_extendLength}/>);
            sessionLengthMobileHelpText = (<FormattedMessage {...messages.mobileSessionHoursDesc_extendLength}/>);
            sessionLengthSSOHelpText = (<FormattedMessage {...messages.ssoSessionHoursDesc_extendLength}/>);
        } else {
            sessionLengthWebHelpText = (<FormattedMessage {...messages.webSessionHoursDesc}/>);
            sessionLengthMobileHelpText = (<FormattedMessage {...messages.mobileSessionHoursDesc}/>);
            sessionLengthSSOHelpText = (<FormattedMessage {...messages.ssoSessionHoursDesc}/>);
        }
        if (this.props.license.Compliance && !this.state.extendSessionLengthWithActivity) {
            sessionTimeoutSetting = (
                <TextSetting
                    id='sessionIdleTimeoutInMinutes'
                    type='number'
                    label={<FormattedMessage {...messages.sessionIdleTimeout}/>}
                    placeholder={defineMessage({id: 'admin.service.sessionIdleTimeoutEx', defaultMessage: 'E.g.: "60"'})}
                    helpText={<FormattedMarkdownMessage {...messages.sessionIdleTimeoutDesc}/>}
                    value={this.state.sessionIdleTimeoutInMinutes}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionIdleTimeoutInMinutes')}
                    disabled={this.props.isDisabled}
                />
            );
        }

        return (
            <SettingsGroup>
                <BooleanSetting
                    id='extendSessionLengthWithActivity'
                    label={<FormattedMessage {...messages.extendSessionLengthActivity_label}/>}
                    helpText={<FormattedMessage {...messages.extendSessionLengthActivity_helpText}/>}
                    value={this.state.extendSessionLengthWithActivity}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.ExtendSessionLengthWithActivity')}
                    disabled={this.props.isDisabled}
                />
                <TextSetting
                    id='sessionLengthWebInHours'
                    label={<FormattedMessage {...messages.webSessionHours}/>}
                    placeholder={defineMessage(messages.sessionHoursEx)}
                    helpText={sessionLengthWebHelpText}
                    value={this.state.sessionLengthWebInHours}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionLengthWebInHours')}
                    disabled={this.props.isDisabled}
                    type='number'
                />
                <TextSetting
                    id='sessionLengthMobileInHours'
                    label={<FormattedMessage {...messages.mobileSessionHours}/>}
                    placeholder={defineMessage(messages.sessionHoursEx)}
                    helpText={sessionLengthMobileHelpText}
                    value={this.state.sessionLengthMobileInHours}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionLengthMobileInHours')}
                    disabled={this.props.isDisabled}
                    type='number'
                />
                <TextSetting
                    id='sessionLengthSSOInHours'
                    label={<FormattedMessage {...messages.ssoSessionHours}/>}
                    placeholder={defineMessage(messages.sessionHoursEx)}
                    helpText={sessionLengthSSOHelpText}
                    value={this.state.sessionLengthSSOInHours}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionLengthSSOInHours')}
                    disabled={this.props.isDisabled}
                    type='number'
                />
                <TextSetting
                    id='sessionCacheInMinutes'
                    label={<FormattedMessage {...messages.sessionCache}/>}
                    placeholder={defineMessage({id: 'admin.service.sessionMinutesEx', defaultMessage: 'E.g.: "10"'})}
                    helpText={<FormattedMessage {...messages.sessionCacheDesc}/>}
                    value={this.state.sessionCacheInMinutes}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionCacheInMinutes')}
                    disabled={this.props.isDisabled}
                    type='number'
                />
                {sessionTimeoutSetting}
            </SettingsGroup>
        );
    };
}
