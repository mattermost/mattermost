// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export default class WebhookSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableIncomingWebhooks = this.state.enableIncomingWebhooks;
        config.ServiceSettings.EnableOutgoingWebhooks = this.state.enableOutgoingWebhooks;
        config.ServiceSettings.EnableCommands = this.state.enableCommands;
        config.ServiceSettings.EnableOnlyAdminIntegrations = this.state.enableOnlyAdminIntegrations;
        config.ServiceSettings.EnablePostUsernameOverride = this.state.enablePostUsernameOverride;
        config.ServiceSettings.EnablePostIconOverride = this.state.enablePostIconOverride;
        config.ServiceSettings.EnableOAuthServiceProvider = this.state.enableOAuthServiceProvider;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enableIncomingWebhooks: config.ServiceSettings.EnableIncomingWebhooks,
            enableOutgoingWebhooks: config.ServiceSettings.EnableOutgoingWebhooks,
            enableCommands: config.ServiceSettings.EnableCommands,
            enableOnlyAdminIntegrations: config.ServiceSettings.EnableOnlyAdminIntegrations,
            enablePostUsernameOverride: config.ServiceSettings.EnablePostUsernameOverride,
            enablePostIconOverride: config.ServiceSettings.EnablePostIconOverride,
            enableOAuthServiceProvider: config.ServiceSettings.EnableOAuthServiceProvider
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.integrations.custom'
                defaultMessage='Custom Integrations'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableIncomingWebhooks'
                    label={
                        <FormattedMessage
                            id='admin.service.webhooksTitle'
                            defaultMessage='Enable Incoming Webhooks: '
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.webhooksDescription'
                            defaultMessage='When true, incoming webhooks will be allowed. To help combat phishing attacks, all posts from webhooks will be labelled by a BOT tag. See <a href="http://docs.mattermost.com/developer/webhooks-incoming.html" target="_blank">documentation</a> to learn more.'
                        />
                    }
                    value={this.state.enableIncomingWebhooks}
                    onChange={this.handleChange}
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
                        <FormattedHTMLMessage
                            id='admin.service.outWebhooksDesc'
                            defaultMessage='When true, outgoing webhooks will be allowed. See <a href="http://docs.mattermost.com/developer/webhooks-outgoing.html" target="_blank">documentation</a> to learn more.'
                        />
                    }
                    value={this.state.enableOutgoingWebhooks}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enableCommands'
                    label={
                        <FormattedMessage
                            id='admin.service.cmdsTitle'
                            defaultMessage='Enable Custom Slash Commands: '
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.cmdsDesc'
                            defaultMessage='When true, custom slash commands will be allowed. See <a href="http://docs.mattermost.com/developer/slash-commands.html" target="_blank">documentation</a> to learn more.'
                        />
                    }
                    value={this.state.enableCommands}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enableOAuthServiceProvider'
                    label={
                        <FormattedMessage
                            id='admin.oauth.providerTitle'
                            defaultMessage='Enable OAuth 2.0 Service Provider: '
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.oauth.providerDescription'
                            defaultMessage='When true, Mattermost can act as an OAuth 2.0 service provider allowing Mattermost to authorize API requests from external applications. See <a href="https://docs.mattermost.com/developer/oauth-2-0-applications.html" target="_blank">documentation</a> to learn more.'
                        />
                    }
                    value={this.state.enableOAuthServiceProvider}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enableOnlyAdminIntegrations'
                    label={
                        <FormattedMessage
                            id='admin.service.integrationAdmin'
                            defaultMessage='Restrict managing integrations to Admins:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.integrationAdminDesc'
                            defaultMessage='When true, webhooks and slash commands can only be created, edited and viewed by Team and System Admins, and OAuth 2.0 applications by System Admins. Integrations are available to all users after they have been created by the Admin.'
                        />
                    }
                    value={this.state.enableOnlyAdminIntegrations}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enablePostUsernameOverride'
                    label={
                        <FormattedMessage
                            id='admin.service.overrideTitle'
                            defaultMessage='Enable integrations to override usernames:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.overrideDescription'
                            defaultMessage='When true, webhooks, slash commands and other integrations, such as <a href="https://docs.mattermost.com/integrations/zapier.html" target="_blank">Zapier</a>, will be allowed to change the username they are posting as. Note: Combined with allowing integrations to override profile picture icons, users may be able to perform phishing attacks by attempting to impersonate other users.'
                        />
                    }
                    value={this.state.enablePostUsernameOverride}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enablePostIconOverride'
                    label={
                        <FormattedMessage
                            id='admin.service.iconTitle'
                            defaultMessage='Enable integrations to override profile picture icons:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.iconDescription'
                            defaultMessage='When true, webhooks, slash commands and other integrations, such as <a href="https://docs.mattermost.com/integrations/zapier.html" target="_blank">Zapier</a>, will be allowed to change the profile picture they post with. Note: Combined with allowing integrations to override usernames, users may be able to perform phishing attacks by attempting to impersonate other users.'
                        />
                    }
                    value={this.state.enablePostIconOverride}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
