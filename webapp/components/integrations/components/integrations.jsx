// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import IntegrationOption from './integration_option.jsx';

import WebhookIcon from 'images/webhook_icon.jpg';
import AppIcon from 'images/oauth_icon.png';

export default class Integrations extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    render() {
        const options = [];
        const config = window.mm_config;

        if (config.EnableIncomingWebhooks === 'true') {
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
                    link={'/' + this.props.team.name + '/integrations/incoming_webhooks'}
                />
            );
        }

        if (config.EnableOutgoingWebhooks === 'true') {
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
                    link={'/' + this.props.team.name + '/integrations/outgoing_webhooks'}
                />
            );
        }

        if (config.EnableCommands === 'true') {
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
                    link={'/' + this.props.team.name + '/integrations/commands'}
                />
            );
        }

        if (config.EnableOAuthServiceProvider === 'true') {
            options.push(
                <IntegrationOption
                    key='oauth2Apps'
                    image={AppIcon}
                    title={
                        <FormattedMessage
                            id='integrations.oauthApps.title'
                            defaultMessage='OAuth 2.0 Applications'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='integrations.oauthApps.description'
                            defaultMessage='Auth 2.0 allows external applications to make authorized requests to the Mattermost API.'
                        />
                    }
                    link={'/' + this.props.team.name + '/integrations/oauth2-apps'}
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

