// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import IntegrationOption from './integration_option.jsx';
import * as Utils from 'utils/utils.jsx';

import WebhookIcon from 'images/webhook_icon.jpg';
import AppIcon from 'images/app_icon.png';

export default class Integrations extends React.Component {
    render() {
        const options = [];

        if (window.mm_config.EnableIncomingWebhooks === 'true') {
            options.push(
                <IntegrationOption
                    key='incomingWebhook'
                    image={WebhookIcon}
                    title={
                        <FormattedMessage
                            id='integrations.incomingWebhook.title'
                            defaultMessage='Incoming Webhook'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='integrations.incomingWebhook.description'
                            defaultMessage='Incoming webhooks allow external integrations to send messages'
                        />
                    }
                    link={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/incoming_webhooks'}
                />
            );
        }

        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
            options.push(
                <IntegrationOption
                    key='outgoingWebhook'
                    image={WebhookIcon}
                    title={
                        <FormattedMessage
                            id='integrations.outgoingWebhook.title'
                            defaultMessage='Outgoing Webhook'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='integrations.outgoingWebhook.description'
                            defaultMessage='Outgoing webhooks allow external integrations to receive and respond to messages'
                        />
                    }
                    link={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/outgoing_webhooks'}
                />
            );
        }

        if (window.mm_config.EnableCommands === 'true') {
            options.push(
                <IntegrationOption
                    key='command'
                    image={WebhookIcon}
                    title={
                        <FormattedMessage
                            id='integrations.command.title'
                            defaultMessage='Slash Command'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='integrations.command.description'
                            defaultMessage='Slash commands send events to an external integration'
                        />
                    }
                    link={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/commands'}
                />
            );
        }

        if (window.mm_config.EnableOAuthServiceProvider === 'true') {
            options.push(
                <IntegrationOption
                    key='oauthApps'
                    image={AppIcon}
                    title={
                        <FormattedMessage
                            id='integrations.oauthApps.title'
                            defaultMessage='OAuth Apps'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='integrations.oauthApps.description'
                            defaultMessage='OAuth apps allow external applications to authenticate users against Mattermost'
                        />
                    }
                    link={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/oauth-apps'}
                />
            );
        }

        return (
            <div className='backstage-content row'>
                <div className='backstage-header'>
                    <h1>
                        <FormattedMessage
                            id='integrations.header'
                            defaultMessage='Integrations'
                        />
                    </h1>
                </div>
                <div>
                    {options}
                </div>
            </div>
        );
    }
}

