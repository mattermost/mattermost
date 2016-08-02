// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class SessionSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ServiceSettings.SessionLengthWebInDays = this.parseIntNonZero(this.state.sessionLengthWebInDays);
        config.ServiceSettings.SessionLengthMobileInDays = this.parseIntNonZero(this.state.sessionLengthMobileInDays);
        config.ServiceSettings.SessionLengthSSOInDays = this.parseIntNonZero(this.state.sessionLengthSSOInDays);
        config.ServiceSettings.SessionCacheInMinutes = this.parseIntNonZero(this.state.sessionCacheInMinutes);

        return config;
    }

    getStateFromConfig(config) {
        return {
            sessionLengthWebInDays: config.ServiceSettings.SessionLengthWebInDays,
            sessionLengthMobileInDays: config.ServiceSettings.SessionLengthMobileInDays,
            sessionLengthSSOInDays: config.ServiceSettings.SessionLengthSSOInDays,
            sessionCacheInMinutes: config.ServiceSettings.SessionCacheInMinutes
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.security.session'
                    defaultMessage='Sessions'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <TextSetting
                    id='sessionLengthWebInDays'
                    label={
                        <FormattedMessage
                            id='admin.service.webSessionDays'
                            defaultMessage='Session length LDAP and email (days):'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionDaysEx', 'Ex "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.webSessionDaysDesc'
                            defaultMessage='The number of days from the last time a user entered their credentials to the expiry of the users session. After changing this setting, the new session length will take effect after the next time the user enters their credentials.'
                        />
                    }
                    value={this.state.sessionLengthWebInDays}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='sessionLengthMobileInDays'
                    label={
                        <FormattedMessage
                            id='admin.service.mobileSessionDays'
                            defaultMessage='Session length mobile (days):'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionDaysEx', 'Ex "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.mobileSessionDaysDesc'
                            defaultMessage='The number of days from the last time a user entered their credentials to the expiry of the users session. After changing this setting, the new session length will take effect after the next time the user enters their credentials.'
                        />
                    }
                    value={this.state.sessionLengthMobileInDays}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='sessionLengthSSOInDays'
                    label={
                        <FormattedMessage
                            id='admin.service.ssoSessionDays'
                            defaultMessage='Session length SSO (days):'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionDaysEx', 'Ex "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.ssoSessionDaysDesc'
                            defaultMessage='The number of days from the last time a user entered their credentials to the expiry of the users session. If the authentication method is SAML or GitLab, the user may automatically be logged back in to Mattermost if they are already logged in to SAML or GitLab. After changing this setting, the setting will take effect after the next time the user enters their credentials. '
                        />
                    }
                    value={this.state.sessionLengthSSOInDays}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='sessionCacheInMinutes'
                    label={
                        <FormattedMessage
                            id='admin.service.sessionCache'
                            defaultMessage='Session Cache (minutes):'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionDaysEx', 'Ex "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.sessionCacheDesc'
                            defaultMessage='The number of minutes to cache a session in memory.'
                        />
                    }
                    value={this.state.sessionCacheInMinutes}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
