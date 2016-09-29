// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import SettingsGroup from './settings_group.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import BooleanSetting from './boolean_setting.jsx';

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
        config.TeamSettings.EnableGuestAccounts = this.state.enableGuestAccounts;

        return config;
    }

    getStateFromConfig(config) {
        return {
            restrictTeamInvite: config.TeamSettings.RestrictTeamInvite,
            restrictPublicChannelManagement: config.TeamSettings.RestrictPublicChannelManagement,
            restrictPrivateChannelManagement: config.TeamSettings.RestrictPrivateChannelManagement,
            enableGuestAccounts: config.TeamSettings.EnableGuestAccounts
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
                            defaultMessage='Set policy on who can invite others to a team using <b>Invite New Member</b> to invite new users by email, or the <b>Get Team Invite Link</b> options from the Main Menu. If <b>Get Team Invite Link</b> is used to share a link, you can expire the invite code from <b>Team Settings</b> > <b>Invite Code</b> after the desired users join the team.'
                        />
                    }
                />
                <BooleanSetting
                    id='enableGuestAccounts'
                    label={
                        <FormattedMessage
                            id='admin.general.policy.enable_guest_accounts.title'
                            defaultMessage='Enable Guest Accounts:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.enable_guest_accounts.description'
                            defaultMessage='When true, any user who is able to send team invites will have the option to invite guest accounts that only have access to one channel on a team. Single-channel guest accounts do not count as a user for billing purposes.'
                        />
                    }
                    value={this.state.enableGuestAccounts}
                    onChange={this.handleChange}
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
                            defaultMessage='Set policy on who can create, delete, rename, and set the header or purpose for public channels.'
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
                            defaultMessage='Set policy on who can create, delete, rename, and set the header or purpose for private groups.'
                        />
                    }
                />
            </SettingsGroup>
        );
    }
}
