// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {ExternalServiceSettings} from './external_service_settings.jsx';
import {FormattedMessage} from 'react-intl';
import {WebhookSettings} from './webhook_settings.jsx';

export default class IntegrationSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enableIncomingWebhooks: props.config.ServiceSettings.EnableIncomingWebhooks,
            enableOutgoingWebhooks: props.config.ServiceSettings.EnableOutgoingWebhooks,
            enableCommands: props.config.ServiceSettings.EnableCommands,
            enableOnlyAdminIntegrations: props.config.ServiceSettings.EnableOnlyAdminIntegrations,
            enablePostUsernameOverride: props.config.ServiceSettings.EnablePostUsernameOverride,
            enablePostIconOverride: props.config.ServiceSettings.EnablePostIconOverride,

            segmentDeveloperKey: props.config.ServiceSettings.SegmentDeveloperKey,
            googleDeveloperKey: props.config.ServiceSettings.GoogleDeveloperKey
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableIncomingWebhooks = this.state.enableIncomingWebhooks;
        config.ServiceSettings.EnableOutgoingWebhooks = this.state.enableOutgoingWebhooks;
        config.ServiceSettings.EnableCommands = this.state.enableCommands;
        config.ServiceSettings.EnableOnlyAdminIntegrations = this.state.enableOnlyAdminIntegrations;
        config.ServiceSettings.EnablePostUsernameOverride = this.state.enablePostUsernameOverride;
        config.ServiceSettings.EnablePostIconOverride = this.state.enablePostIconOverride;

        config.ServiceSettings.SegmentDeveloperKey = this.state.segmentDeveloperKey;
        config.ServiceSettings.GoogleDeveloperKey = this.state.googleDeveloperKey;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.integrations.title'
                    defaultMessage='Integration Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <div>
                <WebhookSettings
                    enableIncomingWebhooks={this.state.enableIncomingWebhooks}
                    enableOutgoingWebhooks={this.state.enableOutgoingWebhooks}
                    enableCommands={this.state.enableCommands}
                    enableOnlyAdminIntegrations={this.state.enableOnlyAdminIntegrations}
                    enablePostUsernameOverride={this.state.enablePostUsernameOverride}
                    enablePostIconOverride={this.state.enablePostIconOverride}
                    onChange={this.handleChange}
                />
                <ExternalServiceSettings
                    segmentDeveloperKey={this.state.segmentDeveloperKey}
                    googleDeveloperKey={this.state.googleDeveloperKey}
                    onChange={this.handleChange}
                />
            </div>
        );
    }
}
