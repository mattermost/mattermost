// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import GeneratedSetting from './generated_setting.jsx';
import SettingsGroup from './settings_group.jsx';

export default class PublicLinkSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.FileSettings.EnablePublicLink = this.state.enablePublicLink;
        config.FileSettings.PublicLinkSalt = this.state.publicLinkSalt;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enablePublicLink: config.FileSettings.EnablePublicLink,
            publicLinkSalt: config.FileSettings.PublicLinkSalt
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.security.public_links'
                defaultMessage='Public Links'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enablePublicLink'
                    label={
                        <FormattedMessage
                            id='admin.image.shareTitle'
                            defaultMessage='Enable Public File Links: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.image.shareDescription'
                            defaultMessage='Allow users to share public links to files and images.'
                        />
                    }
                    value={this.state.enablePublicLink}
                    onChange={this.handleChange}
                />
                <GeneratedSetting
                    id='publicLinkSalt'
                    label={
                        <FormattedMessage
                            id='admin.image.publicLinkTitle'
                            defaultMessage='Public Link Salt:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.image.publicLinkDescription'
                            defaultMessage='32-character salt added to signing of public image links. Randomly generated on install. Click "Regenerate" to create new salt.'
                        />
                    }
                    value={this.state.publicLinkSalt}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
