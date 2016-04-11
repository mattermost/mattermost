// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import GeneratedSetting from './generated_setting.jsx';
import SettingsGroup from './settings_group.jsx';

export class PublicLinkSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enablePublicLink: props.config.FileSettings.EnablePublicLink,
            publicLinkSalt: props.config.FileSettings.PublicLinkSalt
        });
    }

    getConfigFromState(config) {
        config.FileSettings.EnablePublicLink = this.state.enablePublicLink;
        config.FileSettings.PublicLinkSalt = this.state.publicLinkSalt;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.security.title'
                    defaultMessage='Security Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <PublicLinkSettings
                enablePublicLink={this.state.enablePublicLink}
                publicLinkSalt={this.state.publicLinkSalt}
                onChange={this.handleChange}
            />
        );
    }
}

export class PublicLinkSettings extends React.Component {
    static get propTypes() {
        return {
            enablePublicLink: React.PropTypes.bool.isRequired,
            publicLinkSalt: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.security.public_links'
                        defaultMessage='Public Links'
                    />
                }
            >
                <BooleanSetting
                    id='enablePublicLink'
                    label={
                        <FormattedMessage
                            id='admin.image.shareTitle'
                            defaultMessage='Share Public File Link: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.image.shareDescription'
                            defaultMessage='Allow users to share public links to files and images.'
                        />
                    }
                    value={this.props.enablePublicLink}
                    onChange={this.props.onChange}
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
                            defaultMessage='32-character salt added to signing of public image links. Randomly generated on install. Click "Re-Generate" to create new salt.'
                        />
                    }
                    value={this.props.publicLinkSalt}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}
