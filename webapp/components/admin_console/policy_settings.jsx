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

        this.state = Object.assign(this.state, {
            restrictTeamInvite: props.config.TeamSettings.RestrictTeamInvite
        });
    }

    getConfigFromState(config) {
        config.TeamSettings.RestrictTeamInvite = this.state.restrictTeamInvite;

        return config;
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
                        {value: Constants.TEAM_INVITE_ALL, text: Utils.localizeMessage('admin.general.policy.teamInviteAll', 'All team members')},
                        {value: Constants.TEAM_INVITE_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.teamInviteAdmin', 'Team and System Admins')},
                        {value: Constants.TEAM_INVITE_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.teamInviteSystemAdmin', 'System Admins')}
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
            </SettingsGroup>
        );
    }
}
