// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class ExternalServiceSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            segmentDeveloperKey: props.config.ServiceSettings.SegmentDeveloperKey,
            googleDeveloperKey: props.config.ServiceSettings.GoogleDeveloperKey
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.SegmentDeveloperKey = this.state.segmentDeveloperKey;
        config.ServiceSettings.GoogleDeveloperKey = this.state.googleDeveloperKey;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.integration.title'
                    defaultMessage='Integration Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <ExternalServiceSettings
                segmentDeveloperKey={this.state.segmentDeveloperKey}
                googleDeveloperKey={this.state.googleDeveloperKey}
                onChange={this.handleChange}
            />
        );
    }
}

export class ExternalServiceSettings extends React.Component {
    static get propTypes() {
        return {
            segmentDeveloperKey: React.PropTypes.string.isRequired,
            googleDeveloperKey: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.integrations.external'
                        defaultMessage='External Services'
                    />
                }
            >
                <TextSetting
                    id='segmentDeveloperKey'
                    label={
                        <FormattedMessage
                            id='admin.service.segmentTitle'
                            defaultMessage='Segment Developer Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.segmentExample', 'Ex "g3fgGOXJAQ43QV7rAh6iwQCkV4cA1Gs"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.segmentDescription'
                            defaultMessage='For users running a SaaS services, sign up for a key at Segment.com to track metrics.'
                        />
                    }
                    value={this.props.segmentDeveloperKey}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='googleDeveloperKey'
                    label={
                        <FormattedMessage
                            id='admin.service.googleTitle'
                            defaultMessage='Google Developer Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.googleExample', 'Ex "7rAh6iwQCkV4cA1Gsg3fgGOXJAQ43QV"')}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.googleDescription'
                            defaultMessage='Set this key to enable embedding of YouTube video previews based on hyperlinks appearing in messages or comments. Instructions to obtain a key available at <a href="https://www.youtube.com/watch?v=Im69kzhpR3I" target="_blank">https://www.youtube.com/watch?v=Im69kzhpR3I</a>. Leaving the field blank disables the automatic generation of YouTube video previews from links.'
                        />
                    }
                    value={this.props.googleDeveloperKey}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}