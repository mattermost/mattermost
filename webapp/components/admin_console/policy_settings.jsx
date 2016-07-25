// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import SettingsGroup from './settings_group.jsx';
import DropdownSetting from './dropdown_setting.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

export default class PolicySettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.TeamSettings.RestrictTeamInvite = this.state.restrictTeamInvite;
        config.TeamSettings.RestrictPublicChannelManagement = this.state.restrictPublicChannelManagement;
        config.TeamSettings.RestrictPrivateChannelManagement = this.state.restrictPrivateChannelManagement;

        return config;
    }

    getStateFromConfig(config) {
        return {
            restrictTeamInvite: config.TeamSettings.RestrictTeamInvite,
            restrictPublicChannelManagement: config.TeamSettings.RestrictPublicChannelManagement,
            restrictPrivateChannelManagement: config.TeamSettings.RestrictPrivateChannelManagement
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.general.policy'
                    defaultMessage='Policy'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <DropdownSetting
                    id='restrictTeamInvite'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAll', 'All team members')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.teamInviteTitle'
                            defaultMessage='Enable sending team invites from:'
                        />
                    }
                    value={this.state.restrictTeamInvite}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.general.policy.teamInviteDescription'
                            defaultMessage='Selecting "All team members" allows any team member to invite others using an email invitation or team invite link.<br/><br/>Selecting "Team and System Admins" hides the email invitation and team invite link in the Main Menu from users who are not Team or System Admins. Note: If "Get Team Invite Link" is used to share a link, it will need to be regenerated after the desired users joined the team.<br/><br/>Selecting "System Admins" hides the email invitation and team invite link in the Main Menu from users who are not System Admins. Note: If "Get Team Invite Link" is used to share a link, it will need to be regenerated after the desired users joined the team.'
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPublicChannelManagement'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAll', 'All team members')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPublicChannelManagementTitle'
                            defaultMessage='Enable public channel management permissions for:'
                        />
                    }
                    value={this.state.restrictPublicChannelManagement}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.general.policy.restrictPublicChannelManagementDescription'
                            defaultMessage='Selecting "All team members" allows any team members to create, delete, rename, and set the header or purpose for public channels.<br/><br/>Selecting "Team and System Admins" restricts channel management permissions for public channels to Team and System Admins, including creating, deleting, renaming, and setting the channel header or purpose.<br/><br/>Selecting "System Admins" restricts channel management permissions for public channels to System Admins, including creating, deleting, renaming, and setting the channel header or purpose.'
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPrivateChannelManagement'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAll', 'All team members')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelManagementTitle'
                            defaultMessage='Enable private group management permissions for:'
                        />
                    }
                    value={this.state.restrictPrivateChannelManagement}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.general.policy.restrictPrivateChannelManagementDescription'
                            defaultMessage='Selecting "All team members" allows any team members to create, delete, rename, and set the header or purpose for private groups.<br/><br/>Selecting "Team and System Admins" restricts group management permissions for private groups to Team and System Admins, including creating, deleting, renaming, and setting the group header or purpose.<br/><br/>Selecting "System Admins" restricts group management permissions for private groups to System Admins, including creating, deleting, renaming, and setting the group header or purpose.'
                        />
                    }
                />
            </SettingsGroup>
        );
    }
}
