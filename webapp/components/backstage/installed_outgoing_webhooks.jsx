// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import InstalledOutgoingWebhook from './installed_outgoing_webhook.jsx';
import InstalledIntegrations from './installed_integrations.jsx';

export default class InstalledOutgoingWebhooks extends React.Component {
    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);

        this.regenOutgoingWebhookToken = this.regenOutgoingWebhookToken.bind(this);
        this.deleteOutgoingWebhook = this.deleteOutgoingWebhook.bind(this);

        this.state = {
            outgoingWebhooks: []
        };
    }

    componentWillMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
            if (IntegrationStore.hasReceivedOutgoingWebhooks()) {
                this.setState({
                    outgoingWebhooks: IntegrationStore.getOutgoingWebhooks()
                });
            } else {
                AsyncClient.listOutgoingHooks();
            }
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        this.setState({
            outgoingWebhooks: IntegrationStore.getOutgoingWebhooks()
        });
    }

    regenOutgoingWebhookToken(outgoingWebhook) {
        AsyncClient.regenOutgoingHookToken(outgoingWebhook.id);
    }

    deleteOutgoingWebhook(outgoingWebhook) {
        AsyncClient.deleteOutgoingHook(outgoingWebhook.id);
    }

    render() {
        const outgoingWebhooks = this.state.outgoingWebhooks.map((outgoingWebhook) => {
            return (
                <InstalledOutgoingWebhook
                    key={outgoingWebhook.id}
                    outgoingWebhook={outgoingWebhook}
                    onRegenToken={this.regenOutgoingWebhookToken}
                    onDelete={this.deleteOutgoingWebhook}
                />
            );
        });

        return (
            <InstalledIntegrations
                header={
                    <FormattedMessage
                        id='installed_outgoing_webhooks.header'
                        defaultMessage='Installed Outgoing Webhooks'
                    />
                }
                addText={
                    <FormattedMessage
                        id='installed_outgoing_webhooks.add'
                        defaultMessage='Add Outgoing Webhook'
                    />
                }
                addLink={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/outgoing_webhooks/add'}
            >
                {outgoingWebhooks}
            </InstalledIntegrations>
        );
    }
}
