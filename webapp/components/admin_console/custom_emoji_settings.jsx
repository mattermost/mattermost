// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export default class CustomEmojiSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enableCustomEmoji: props.config.ServiceSettings.EnableCustomEmoji,
            restrictCustomEmojiCreation: props.config.ServiceSettings.RestrictCustomEmojiCreation
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableCustomEmoji = this.state.enableCustomEmoji;

        if (global.window.mm_license.IsLicensed === 'true') {
            config.ServiceSettings.RestrictCustomEmojiCreation = this.state.restrictCustomEmojiCreation;
        }

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.customization.customEmoji'
                    defaultMessage='Custom Emoji'
                />
            </h3>
        );
    }

    renderSettings() {
        let restrictSetting = null;
        if (global.window.mm_license.IsLicensed === 'true') {
            restrictSetting = (
                <DropdownSetting
                    id='restrictCustomEmojiCreation'
                    values={[
                        {value: 'all', text: Utils.localizeMessage('admin.customization.restrictCustomEmojiCreationAll', 'Allow everyone to create custom emoji')},
                        {value: 'admin', text: Utils.localizeMessage('admin.customization.restrictCustomEmojiCreationAdmin', 'Allow system and team admins to create custom emoji')},
                        {value: 'system_admin', text: Utils.localizeMessage('admin.customization.restrictCustomEmojiCreationSystemAdmin', 'Only allow system admins to create custom emoji')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.customization.restrictCustomEmojiCreationTitle'
                            defaultMessage='Restrict Custom Emoji Creation:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.customization.restrictCustomEmojiCreationDesc'
                            defaultMessage='Restrict the creation of custom emoji to certain users.'
                        />
                    }
                    value={this.state.restrictCustomEmojiCreation}
                    onChange={this.handleChange}
                    disabled={!this.state.enableCustomEmoji}
                />
            );
        }

        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableCustomEmoji'
                    label={
                        <FormattedMessage
                            id='admin.customization.enableCustomEmojiTitle'
                            defaultMessage='Enable Custom Emoji:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.customization.enableCustomEmojiDesc'
                            defaultMessage='Enable users to create custom emoji for use in chat messages.'
                        />
                    }
                    value={this.state.enableCustomEmoji}
                    onChange={this.handleChange}
                />
                {restrictSetting}
            </SettingsGroup>
        );
    }
}