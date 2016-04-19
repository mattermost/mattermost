// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import InstalledIncomingWebhook from './installed_incoming_webhook.jsx';
import InstalledIntegrations from './installed_integrations.jsx';

export default class InstalledIncomingWebhooks extends React.Component {
    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);

        this.deleteIncomingWebhook = this.deleteIncomingWebhook.bind(this);

        this.state = {
            incomingWebhooks: []
        };
    }

    componentWillMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

        if (window.mm_config.EnableIncomingWebhooks === 'true') {
            if (IntegrationStore.hasReceivedIncomingWebhooks()) {
                this.setState({
                    incomingWebhooks: IntegrationStore.getIncomingWebhooks()
                });
            } else {
                AsyncClient.listIncomingHooks();
            }
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        this.setState({
            incomingWebhooks: IntegrationStore.getIncomingWebhooks()
        });
    }

    deleteIncomingWebhook(incomingWebhook) {
        AsyncClient.deleteIncomingHook(incomingWebhook.id);
    }

    render() {
        const incomingWebhooks = this.state.incomingWebhooks.map((incomingWebhook) => {
            return (
                <InstalledIncomingWebhook
                    key={incomingWebhook.id}
                    incomingWebhook={incomingWebhook}
                    onDelete={this.deleteIncomingWebhook}
                />
            );
        });

        return (
            <InstalledIntegrations
                header={
                    <FormattedMessage
                        id='installed_incoming_webhooks.header'
                        defaultMessage='Installed Incoming Webhooks'
                    />
                }
                addText={
                    <FormattedMessage
                        id='installed_incoming_webhooks.add'
                        defaultMessage='Add Incoming Webhook'
                    />
                }
                addLink={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/incoming_webhooks/add'}
            >
                {incomingWebhooks}
            </InstalledIntegrations>
        );
    }
}
