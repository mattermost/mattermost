// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {ConfigurationSettings} from './configuration_settings.jsx';
import {FormattedMessage} from 'react-intl';
import {LogSettings} from './log_settings.jsx';
import {PrivacySettings} from './privacy_settings.jsx';
import {UsersAndTeamsSettings} from './users_and_teams_settings.jsx';

export default class GeneralSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            listenAddress: props.config.ServiceSettings.ListenAddress,

            enableUserCreation: props.config.TeamSettings.EnableUserCreation,
            enableTeamCreation: props.config.TeamSettings.EnableTeamCreation,
            maxUsersPerTeam: props.config.TeamSettings.MaxUsersPerTeam,
            restrictCreationToDomains: props.config.TeamSettings.RestrictCreationToDomains,
            restrictTeamNames: props.config.TeamSettings.RestrictTeamNames,

            showEmailAddress: props.config.PrivacySettings.ShowEmailAddress,
            showFullName: props.config.PrivacySettings.ShowFullName,

            enableConsole: props.config.LogSettings.EnableConsole,
            consoleLevel: props.config.LogSettings.ConsoleLevel,
            enableFile: props.config.LogSettings.EnableFile,
            fileLevel: props.config.LogSettings.FileLevel,
            fileLocation: props.config.LogSettings.FileLocation,
            fileFormat: props.config.LogSettings.FileFormat
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.ListenAddress = this.state.listenAddress;

        config.TeamSettings.EnableUserCreation = this.state.enableUserCreation;
        config.TeamSettings.EnableTeamCreation = this.state.enableTeamCreation;
        config.TeamSettings.MaxUsersPerTeam = this.parseIntNonZero(this.state.maxUsersPerTeam);
        config.TeamSettings.RestrictCreationToDomains = this.state.restrictCreationToDomains;
        config.TeamSettings.RestrictTeamNames = this.state.restrictTeamNames;

        config.PrivacySettings.ShowEmailAddress = this.state.showEmailAddress;
        config.PrivacySettings.ShowFullName = this.state.showFullName;

        config.LogSettings.EnableConsole = this.state.enableConsole;
        config.LogSettings.ConsoleLevel = this.state.consoleLevel;
        config.LogSettings.EnableFile = this.state.enableFile;
        config.LogSettings.FileLevel = this.state.fileLevel;
        config.LogSettings.FileLocation = this.state.fileLocation;
        config.LogSettings.FileFormat = this.state.fileFormat;

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
            <div>
                <ConfigurationSettings
                    listenAddress={this.state.listenAddress}
                    onChange={this.handleChange}
                />
                <UsersAndTeamsSettings
                    enableUserCreation={this.state.enableUserCreation}
                    enableTeamCreation={this.state.enableTeamCreation}
                    maxUsersPerTeam={this.state.maxUsersPerTeam}
                    restrictCreationToDomains={this.state.restrictCreationToDomains}
                    restrictTeamNames={this.state.restrictTeamNames}
                    onChange={this.handleChange}
                />
                <PrivacySettings
                    showEmailAddress={this.state.showEmailAddress}
                    showFullName={this.state.showFullName}
                    onChange={this.handleChange}
                />
                <LogSettings
                    enableConsole={this.state.enableConsole}
                    consoleLevel={this.state.consoleLevel}
                    enableFile={this.state.enableFile}
                    fileLevel={this.state.fileLevel}
                    fileLocation={this.state.fileLocation}
                    fileFormat={this.state.fileFormat}
                    onChange={this.handleChange}
                />
            </div>
        );
    }
}
