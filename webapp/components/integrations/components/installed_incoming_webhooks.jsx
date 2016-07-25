// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as Utils from 'utils/utils.jsx';

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import {FormattedMessage} from 'react-intl';
import InstalledIncomingWebhook from './installed_incoming_webhook.jsx';

export default class InstalledIncomingWebhooks extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);

        this.deleteIncomingWebhook = this.deleteIncomingWebhook.bind(this);

        const teamId = TeamStore.getCurrentId();

        this.state = {
            incomingWebhooks: IntegrationStore.getIncomingWebhooks(teamId),
            loading: !IntegrationStore.hasReceivedIncomingWebhooks(teamId)
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

        if (window.mm_config.EnableIncomingWebhooks === 'true') {
            AsyncClient.listIncomingHooks();
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            incomingWebhooks: IntegrationStore.getIncomingWebhooks(teamId),
            loading: !IntegrationStore.hasReceivedIncomingWebhooks(teamId)
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
            <BackstageList
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
                addLink={'/' + this.props.team.name + '/integrations/incoming_webhooks/add'}
                emptyText={
                    <FormattedMessage
                        id='installed_incoming_webhooks.empty'
                        defaultMessage='No incoming webhooks found'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_incoming_webhooks.help'
                        defaultMessage='Create incoming webhook URLs for use in external integrations. Please see {link} to learn more.'
                        values={{
                            link: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='http://docs.mattermost.com/developer/webhooks-incoming.html'
                                >
                                    <FormattedMessage
                                        id='installed_incoming_webhooks.helpLink'
                                        defaultMessage='documentation'
                                    />
                                </a>
                            )
                        }}
                    />
                }
                searchPlaceholder={Utils.localizeMessage('installed_incoming_webhooks.search', 'Search Incoming Webhooks')}
                loading={this.state.loading}
            >
                {incomingWebhooks}
            </BackstageList>
        );
    }
}
