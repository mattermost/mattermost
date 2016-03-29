// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import TeamStore from 'stores/team_store.jsx';

import {FormattedMessage} from 'react-intl';
import AddIntegrationOption from './add_integration_option.jsx';

import WebhookIcon from 'images/webhook_icon.jpg';

export default class AddIntegration extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);

        this.state = {
            team: TeamStore.getCurrent()
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.handleChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.handleChange);
    }

    handleChange() {
        this.setState({
            team: TeamStore.getCurrent()
        });
    }

    render() {
        const team = TeamStore.getCurrent();

        if (!team) {
            return null;
        }

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
                    link={`/${team.name}/integrations/add/incoming_webhook`}
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
                    link={`/${team.name}/integrations/add/outgoing_webhook`}
                />
            );
        }

        return (
            <div className='backstage row'>
                <div className='add-integration'>
                    <div className='backstage__header'>
                        <h1 className='text'>
                            <FormattedMessage
                                id='add_integration.header'
                                defaultMessage='Add Integration'
                            />
                        </h1>
                    </div>
                </div>
                <div className='add-integration__options'>
                    {options}
                </div>
            </div>
        );
    }
}

