// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import InstalledIncomingWebhook from './installed_incoming_webhook.jsx';

import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {loadIncomingHooks} from 'actions/integration_actions.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class InstalledIncomingWebhooks extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);
        this.handleUserChange = this.handleUserChange.bind(this);
        this.deleteIncomingWebhook = this.deleteIncomingWebhook.bind(this);

        const teamId = TeamStore.getCurrentId();

        this.state = {
            incomingWebhooks: IntegrationStore.getIncomingWebhooks(teamId),
            loading: !IntegrationStore.hasReceivedIncomingWebhooks(teamId),
            users: UserStore.getProfiles()
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);
        UserStore.addChangeListener(this.handleUserChange);

        if (window.mm_config.EnableIncomingWebhooks === 'true') {
            loadIncomingHooks();
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
        UserStore.removeChangeListener(this.handleUserChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            incomingWebhooks: IntegrationStore.getIncomingWebhooks(teamId),
            loading: !IntegrationStore.hasReceivedIncomingWebhooks(teamId)
        });
    }

    handleUserChange() {
        this.setState({
            users: UserStore.getProfiles()
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
                    creator={this.state.users[incomingWebhook.user_id] || {}}
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
