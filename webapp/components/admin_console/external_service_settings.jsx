// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class ExternalServiceSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ServiceSettings.SegmentDeveloperKey = this.state.segmentDeveloperKey;
        config.ServiceSettings.GoogleDeveloperKey = this.state.googleDeveloperKey;

        return config;
    }

    getStateFromConfig(config) {
        return {
            segmentDeveloperKey: config.ServiceSettings.SegmentDeveloperKey,
            googleDeveloperKey: config.ServiceSettings.GoogleDeveloperKey
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.integrations.external'
                    defaultMessage='External Services'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <TextSetting
                    id='segmentDeveloperKey'
                    label={
                        <FormattedMessage
                            id='admin.service.segmentTitle'
                            defaultMessage='Segment Write Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.segmentExample', 'Ex "g3fgGOXJAQ43QV7rAh6iwQCkV4cA1Gs"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.segmentDescription'
                            defaultMessage='Segment.com is an online service that can be optionally used to track detailed system statistics. You can obtain a key by signing-up for a free account at Segment.com.'
                        />
                    }
                    value={this.state.segmentDeveloperKey}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='googleDeveloperKey'
                    label={
                        <FormattedMessage
                            id='admin.service.googleTitle'
                            defaultMessage='Google API Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.googleExample', 'Ex "7rAh6iwQCkV4cA1Gsg3fgGOXJAQ43QV"')}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.googleDescription'
                            defaultMessage='Set this key to enable the display of titles for embedded YouTube video previews. Without the key, YouTube previews will still be created based on hyperlinks appearing in messages or comments but they will not show the video title. View a <a href="https://www.youtube.com/watch?v=Im69kzhpR3I" target="_blank">Google Developers Tutorial</a> for instructions on how to obtain a key.'
                        />
                    }
                    value={this.state.googleDeveloperKey}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
