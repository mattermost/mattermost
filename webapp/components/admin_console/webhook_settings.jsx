// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export class WebhookSettingsPage extends AdminSettings {
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
            enablePostIconOverride: props.config.ServiceSettings.EnablePostIconOverride
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableIncomingWebhooks = this.state.enableIncomingWebhooks;
        config.ServiceSettings.EnableOutgoingWebhooks = this.state.enableOutgoingWebhooks;
        config.ServiceSettings.EnableCommands = this.state.enableCommands;
        config.ServiceSettings.EnableOnlyAdminIntegrations = this.state.enableOnlyAdminIntegrations;
        config.ServiceSettings.EnablePostUsernameOverride = this.state.enablePostUsernameOverride;
        config.ServiceSettings.EnablePostIconOverride = this.state.enablePostIconOverride;

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
            <WebhookSettings
                enableIncomingWebhooks={this.state.enableIncomingWebhooks}
                enableOutgoingWebhooks={this.state.enableOutgoingWebhooks}
                enableCommands={this.state.enableCommands}
                enableOnlyAdminIntegrations={this.state.enableOnlyAdminIntegrations}
                enablePostUsernameOverride={this.state.enablePostUsernameOverride}
                enablePostIconOverride={this.state.enablePostIconOverride}
                onChange={this.handleChange}
            />
        );
    }
}

export class WebhookSettings extends React.Component {
    static get propTypes() {
        return {
            enableIncomingWebhooks: React.PropTypes.bool.isRequired,
            enableOutgoingWebhooks: React.PropTypes.bool.isRequired,
            enableCommands: React.PropTypes.bool.isRequired,
            enableOnlyAdminIntegrations: React.PropTypes.bool.isRequired,
            enablePostUsernameOverride: React.PropTypes.bool.isRequired,
            enablePostIconOverride: React.PropTypes.bool.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.integrations.webhook'
                        defaultMessage='Webhooks and Commands'
                    />
                }
            >
                <BooleanSetting
                    id='enableIncomingWebhooks'
                    label={
                        <FormattedMessage
                            id='admin.service.webhooksTitle'
                            defaultMessage='Enable Incoming Webhooks: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.webhooksDescription'
                            defaultMessage='When true, incoming webhooks will be allowed. To help combat phishing attacks, all posts from webhooks will be labelled by a BOT tag.'
                        />
                    }
                    value={this.props.enableIncomingWebhooks}
                    onChange={this.props.onChange}
                />
                <BooleanSetting
                    id='enableOutgoingWebhooks'
                    label={
                        <FormattedMessage
                            id='admin.service.outWebhooksTitle'
                            defaultMessage='Enable Outgoing Webhooks: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.outWebhooksDesc'
                            defaultMessage='When true, outgoing webhooks will be allowed.'
                        />
                    }
                    value={this.props.enableOutgoingWebhooks}
                    onChange={this.props.onChange}
                />
                <BooleanSetting
                    id='enableCommands'
                    label={
                        <FormattedMessage
                            id='admin.service.cmdsTitle'
                            defaultMessage='Enable Slash Commands: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.cmdsDesc'
                            defaultMessage='When true, user created slash commands will be allowed.'
                        />
                    }
                    value={this.props.enableCommands}
                    onChange={this.props.onChange}
                />
                <BooleanSetting
                    id='enableOnlyAdminIntegrations'
                    label={
                        <FormattedMessage
                            id='admin.service.integrationAdmin'
                            defaultMessage='Enable Integrations for Admin Only: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.integrationAdminDesc'
                            defaultMessage='When true, user created integrations can only be created by admins.'
                        />
                    }
                    value={this.props.enableOnlyAdminIntegrations}
                    onChange={this.props.onChange}
                />
                <BooleanSetting
                    id='enablePostUsernameOverride'
                    label={
                        <FormattedMessage
                            id='admin.service.overrideTitle'
                            defaultMessage='Enable Overriding Usernames from Webhooks and Slash Commands: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.overrideDescription'
                            defaultMessage='When true, webhooks and slash commands will be allowed to change the username they are posting as. Note, combined with allowing icon overriding, this could open users up to phishing attacks.'
                        />
                    }
                    value={this.props.enablePostUsernameOverride}
                    onChange={this.props.onChange}
                />
                <BooleanSetting
                    id='enablePostIconOverride'
                    label={
                        <FormattedMessage
                            id='admin.service.iconTitle'
                            defaultMessage='Enable Overriding Icon from Webhooks and Slash Commands: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.iconDescription'
                            defaultMessage='When true, webhooks and slash commands will be allowed to change the icon they post with. Note, combined with allowing username overriding, this could open users up to phishing attacks.'
                        />
                    }
                    value={this.props.enablePostIconOverride}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}
