// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export class PrivacySettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            showEmailAddress: props.config.PrivacySettings.ShowEmailAddress,
            showFullName: props.config.PrivacySettings.ShowFullName
        });
    }

    getConfigFromState(config) {
        config.PrivacySettings.ShowEmailAddress = this.state.showEmailAddress;
        config.PrivacySettings.ShowFullName = this.state.showFullName;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.general.title'
                    defaultMessage='General Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <PrivacySettings
                showEmailAddress={this.state.showEmailAddress}
                showFullName={this.state.showFullName}
                onChange={this.handleChange}
            />
        );
    }
}

export class PrivacySettings extends React.Component {
    static get propTypes() {
        return {
            showEmailAddress: React.PropTypes.bool.isRequired,
            showFullName: React.PropTypes.bool.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.general.privacy'
                        defaultMessage='Privacy'
                    />
                }
            >
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
                            defaultMessage='When false, hides email address of users from other users in the user interface, including team owners and team administrators. Used when system is set up for managing teams where some users choose to keep their contact information private.'
                        />
                    }
                    value={this.props.showEmailAddress}
                    onChange={this.props.onChange}
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
                            defaultMessage='When false, hides full name of users from other users, including team owners and team administrators. Username is shown in place of full name.'
                        />
                    }
                    value={this.props.showFullName}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}
