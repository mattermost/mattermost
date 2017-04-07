// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export default class PrivacySettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.PrivacySettings.ShowEmailAddress = this.state.showEmailAddress;
        config.PrivacySettings.ShowFullName = this.state.showFullName;

        return config;
    }

    getStateFromConfig(config) {
        return {
            showEmailAddress: config.PrivacySettings.ShowEmailAddress,
            showFullName: config.PrivacySettings.ShowFullName
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.general.privacy'
                defaultMessage='Privacy'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='showEmailAddress'
                    label={
                        <FormattedMessage
                            id='admin.privacy.showEmailTitle'
                            defaultMessage='Show Email Address: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.privacy.showEmailDescription'
                            defaultMessage='When false, hides the email address of members from everyone except System Administrators.'
                        />
                    }
                    value={this.state.showEmailAddress}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='showFullName'
                    label={
                        <FormattedMessage
                            id='admin.privacy.showFullNameTitle'
                            defaultMessage='Show Full Name: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.privacy.showFullNameDescription'
                            defaultMessage='When false, hides the full name of members from everyone except System Administrators. Username is shown in place of full name.'
                        />
                    }
                    value={this.state.showFullName}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
