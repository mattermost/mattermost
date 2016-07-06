// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as Utils from 'utils/utils.jsx';

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import {FormattedMessage} from 'react-intl';
import InstalledOutgoingWebhook from './installed_outgoing_webhook.jsx';

export default class InstalledOutgoingWebhooks extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);

        this.regenOutgoingWebhookToken = this.regenOutgoingWebhookToken.bind(this);
        this.deleteOutgoingWebhook = this.deleteOutgoingWebhook.bind(this);

        const teamId = TeamStore.getCurrentId();

        this.state = {
            outgoingWebhooks: IntegrationStore.getOutgoingWebhooks(teamId),
            loading: !IntegrationStore.hasReceivedOutgoingWebhooks(teamId)
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
            AsyncClient.listOutgoingHooks();
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            outgoingWebhooks: IntegrationStore.getOutgoingWebhooks(teamId),
            loading: !IntegrationStore.hasReceivedOutgoingWebhooks(teamId)
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
            <BackstageList
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
                addLink={'/' + this.props.team.name + '/integrations/outgoing_webhooks/add'}
                emptyText={
                    <FormattedMessage
                        id='installed_outgoing_webhooks.empty'
                        defaultMessage='No outgoing webhooks found'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_outgoing_webhooks.help'
                        defaultMessage='Create outgoing webhook URLs for use in external integrations. Please see {link} to learn more.'
                        values={{
                            link: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='http://docs.mattermost.com/developer/webhooks-outgoing.html'
                                >
                                    <FormattedMessage
                                        id='installed_outgoing_webhooks.helpLink'
                                        defaultMessage='documentation'
                                    />
                                </a>
                            )
                        }}
                    />
                }
                searchPlaceholder={Utils.localizeMessage('installed_outgoing_webhooks.search', 'Search Outgoing Webhooks')}
                loading={this.state.loading}
            >
                {outgoingWebhooks}
            </BackstageList>
        );
    }
}
