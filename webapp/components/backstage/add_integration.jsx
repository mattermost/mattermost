// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import AddIntegrationOption from './add_integration_option.jsx';

import WebhookIcon from 'images/webhook_icon.jpg';

export default class AddIntegration extends React.Component {
    render() {
        const options = [];

        if (window.mm_config.EnableIncomingWebhooks === 'true') {
            options.push(
                <AddIntegrationOption
                    key='incomingWebhook'
                    image={WebhookIcon}
                    title={
                        <FormattedMessage
                            id='add_integration.incomingWebhook.title'
                            defaultMessage='Incoming Webhook'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='add_integration.incomingWebhook.description'
                            defaultMessage='Create webhook URLs for use in external integrations.'
                        />
                    }
                    link={'/settings/integrations/add/incoming_webhook'}
                />
            );
        }

        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
            options.push(
                <AddIntegrationOption
                    key='outgoingWebhook'
                    image={WebhookIcon}
                    title={
                        <FormattedMessage
                            id='add_integration.outgoingWebhook.title'
                            defaultMessage='Outgoing Webhook'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='add_integration.outgoingWebhook.description'
                            defaultMessage='Create webhooks to send new message events to an external integration.'
                        />
                    }
                    link={'/settings/integrations/add/outgoing_webhook'}
                />
            );
        }

        if (window.mm_config.EnableCommands === 'true') {
            options.push(
                <AddIntegrationOption
                    key='command'
                    image={WebhookIcon}
                    title={
                        <FormattedMessage
                            id='add_integration.command.title'
                            defaultMessage='Slash Command'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='add_integration.command.description'
                            defaultMessage='Create slash commands to send events to external integrations and receive a response.'
                        />
                    }
                    link={'/settings/integrations/add/command'}
                />
            );
        }

        return (
            <div className='backstage-content row'>
                <div className='backstage-header'>
                    <h1>
                        <FormattedMessage
                            id='add_integration.header'
                            defaultMessage='Add Integration'
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

