// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import * as Utils from 'utils/utils';

import AdminSettings, {BaseState, BaseProps} from './admin_settings';
import BooleanSetting from './boolean_setting';
import SettingsGroup from './settings_group.js';
import TextSetting from './text_setting';
import { DeepPartial } from 'redux';
import { AdminConfig, ServiceSettings } from '@mattermost/types/config';

interface SessionLengthSettingsState extends BaseState {
    extendSessionLengthWithActivity: ServiceSettings['ExtendSessionLengthWithActivity'];
    sessionLengthWebInHours: ServiceSettings['SessionLengthWebInHours'];
    sessionLengthMobileInHours: ServiceSettings['SessionLengthMobileInHours'];
    sessionLengthSSOInHours: ServiceSettings['SessionLengthSSOInHours'];
    sessionCacheInMinutes: ServiceSettings['SessionCacheInMinutes'];
    sessionIdleTimeoutInMinutes: ServiceSettings['SessionIdleTimeoutInMinutes'];
    sessionIdleTimeoutMobileInMinutes: number;
}

interface SessionLengthSettingsProps extends BaseProps {
    license: {
        Compliance: string;
    };
}

export default class SessionLengthSettings extends AdminSettings<SessionLengthSettingsProps, SessionLengthSettingsState> {
    getConfigFromState = (config: DeepPartial<AdminConfig>) => {
        const MINIMUM_IDLE_TIMEOUT = 5;

        config.ServiceSettings!.ExtendSessionLengthWithActivity = this.state.extendSessionLengthWithActivity;
        config.ServiceSettings!.SessionLengthWebInHours = this.parseIntNonZero(this.state.sessionLengthWebInHours);
        config.ServiceSettings!.SessionLengthMobileInHours = this.parseIntNonZero(this.state.sessionLengthMobileInHours);
        config.ServiceSettings!.SessionLengthSSOInHours = this.parseIntNonZero(this.state.sessionLengthSSOInHours);
        config.ServiceSettings!.SessionCacheInMinutes = this.parseIntNonZero(this.state.sessionCacheInMinutes);
        config.ServiceSettings!.SessionIdleTimeoutInMinutes = this.parseIntZeroOrMin(this.state.sessionIdleTimeoutInMinutes, MINIMUM_IDLE_TIMEOUT);

        return config;
    };

    getStateFromConfig(config: DeepPartial<AdminConfig>) {
        return {
            extendSessionLengthWithActivity: config.ServiceSettings!.ExtendSessionLengthWithActivity,
            sessionLengthWebInHours: config.ServiceSettings!.SessionLengthWebInHours,
            sessionLengthMobileInHours: config.ServiceSettings!.SessionLengthMobileInHours,
            sessionLengthSSOInHours: config.ServiceSettings!.SessionLengthSSOInHours,
            sessionCacheInMinutes: config.ServiceSettings!.SessionCacheInMinutes,
            sessionIdleTimeoutInMinutes: config.ServiceSettings!.SessionIdleTimeoutInMinutes,
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.sessionLengths.title'
                defaultMessage='Session Lengths'
            />
        );
    }

    renderSettings = () => {
        let sessionLengthWebHelpText;
        let sessionLengthMobileHelpText;
        let sessionLengthSSOHelpText;
        let sessionTimeoutSetting;
        if (this.state.extendSessionLengthWithActivity) {
            sessionLengthWebHelpText = (
                <FormattedMessage
                    id='admin.service.webSessionHoursDesc.extendLength'
                    defaultMessage="Set the number of hours from the last activity in Mattermost to the expiry of the user's session when using email and AD/LDAP authentication. After changing this setting, the new session length will take effect after the next time the user enters their credentials."
                />
            );
            sessionLengthMobileHelpText = (
                <FormattedMessage
                    id='admin.service.mobileSessionHoursDesc.extendLength'
                    defaultMessage="Set the number of hours from the last activity in Mattermost to the expiry of the user's session on mobile. After changing this setting, the new session length will take effect after the next time the user enters their credentials."
                />
            );
            sessionLengthSSOHelpText = (
                <FormattedMessage
                    id='admin.service.ssoSessionHoursDesc.extendLength'
                    defaultMessage="Set the number of hours from the last activity in Mattermost to the expiry of the user's session for SSO authentication, such as SAML, GitLab and OAuth 2.0. If the authentication method is SAML or GitLab, the user may automatically be logged back in to Mattermost if they are already logged in to SAML or GitLab. After changing this setting, the setting will take effect after the next time the user enters their credentials."
                />
            );
        } else {
            sessionLengthWebHelpText = (
                <FormattedMessage
                    id='admin.service.webSessionHoursDesc'
                    defaultMessage="The number of hours from the last time a user entered their credentials to the expiry of the user's session. After changing this setting, the new session length will take effect after the next time the user enters their credentials."
                />
            );
            sessionLengthMobileHelpText = (
                <FormattedMessage
                    id='admin.service.mobileSessionHoursDesc'
                    defaultMessage="The number of hours from the last time a user entered their credentials to the expiry of the user's session. After changing this setting, the new session length will take effect after the next time the user enters their credentials."
                />
            );
            sessionLengthSSOHelpText = (
                <FormattedMessage
                    id='admin.service.ssoSessionHoursDesc'
                    defaultMessage="The number of hours from the last time a user entered their credentials to the expiry of the user's session. If the authentication method is SAML or GitLab, the user may automatically be logged back in to Mattermost if they are already logged in to SAML or GitLab. After changing this setting, the setting will take effect after the next time the user enters their credentials."
                />
            );
        }
        if (this.props.license.Compliance && !this.state.extendSessionLengthWithActivity) {
            sessionTimeoutSetting = (
                <TextSetting
                    id='sessionIdleTimeoutInMinutes'
                    type='number'
                    label={
                        <FormattedMessage
                            id='admin.service.sessionIdleTimeout'
                            defaultMessage='Session Idle Timeout (minutes):'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionIdleTimeoutEx', 'E.g.: "60"')}
                    helpText={
                        <FormattedMarkdownMessage
                            id='admin.service.sessionIdleTimeoutDesc'
                            defaultMessage="The number of minutes from the last time a user was active on the system to the expiry of the user\'s session. Once expired, the user will need to log in to continue. Minimum is 5 minutes, and 0 is unlimited.\n \nApplies to the desktop app and browsers. For mobile apps, use an EMM provider to lock the app when not in use. In High Availability mode, enable IP hash load balancing for reliable timeout measurement."
                        />
                    }
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
                    label={
                        <FormattedMessage
                            id='admin.service.extendSessionLengthActivity.label'
                            defaultMessage='Extend session length with activity: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.extendSessionLengthActivity.helpText'
                            defaultMessage='When true, sessions will be automatically extended when the user is active in their Mattermost client. Users sessions will only expire if they are not active in their Mattermost client for the entire duration of the session lengths defined in the fields below. When false, sessions will not extend with activity in Mattermost. User sessions will immediately expire at the end of the session length or idle timeouts defined below. '
                        />
                    }
                    value={this.state.extendSessionLengthWithActivity}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.ExtendSessionLengthWithActivity')}
                    disabled={this.props.isDisabled}
                />
                <TextSetting
                    id='sessionLengthWebInHours'
                    label={<FormattedMessage
                        id='admin.service.webSessionHours'
                        defaultMessage='Session Length AD/LDAP and Email (hours):' />}
                    placeholder={Utils.localizeMessage('admin.service.sessionHoursEx', 'E.g.: "720"')}
                    helpText={sessionLengthWebHelpText}
                    value={this.state.sessionLengthWebInHours}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionLengthWebInHours')}
                    disabled={this.props.isDisabled}
                    type={'number'}
                />
                <TextSetting
                    id='sessionLengthMobileInHours'
                    label={<FormattedMessage
                        id='admin.service.mobileSessionHours'
                        defaultMessage='Session Length Mobile (hours):' />}
                    placeholder={Utils.localizeMessage('admin.service.sessionHoursEx', 'E.g.: "720"')}
                    helpText={sessionLengthMobileHelpText}
                    value={this.state.sessionLengthMobileInHours}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionLengthMobileInHours')}
                    disabled={this.props.isDisabled}
                    type={'number'}
                />
                <TextSetting
                    id='sessionLengthSSOInHours'
                    label={<FormattedMessage
                        id='admin.service.ssoSessionHours'
                        defaultMessage='Session Length SSO (hours):' />}
                    placeholder={Utils.localizeMessage('admin.service.sessionHoursEx', 'E.g.: "720"')}
                    helpText={sessionLengthSSOHelpText}
                    value={this.state.sessionLengthSSOInHours}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionLengthSSOInHours')}
                    disabled={this.props.isDisabled}
                    type={'number'}
                />
                <TextSetting
                    id='sessionCacheInMinutes'
                    label={<FormattedMessage
                        id='admin.service.sessionCache'
                        defaultMessage='Session Cache (minutes):' />}
                    placeholder={Utils.localizeMessage('admin.service.sessionMinutesEx', 'E.g.: "10"')}
                    helpText={<FormattedMessage
                        id='admin.service.sessionCacheDesc'
                        defaultMessage='The number of minutes to cache a session in memory:' />}
                    value={this.state.sessionCacheInMinutes}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.SessionCacheInMinutes')}
                    disabled={this.props.isDisabled}
                    type={'number'}
                />
                {sessionTimeoutSetting}
            </SettingsGroup>
        );
    };
}
