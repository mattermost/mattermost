// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import InstalledIncomingWebhook from './installed_incoming_webhook.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {loadIncomingHooksForTeam, deleteIncomingHook} from 'actions/integration_actions.jsx';

import * as Utils from 'utils/utils.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class InstalledIncomingWebhooks extends React.Component {
    static get propTypes() {
        return {
            team: PropTypes.object,
            user: PropTypes.object,
            isAdmin: PropTypes.bool
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
            loadIncomingHooksForTeam(TeamStore.getCurrentId(), () => this.setState({loading: false}));
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
        UserStore.removeChangeListener(this.handleUserChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            incomingWebhooks: IntegrationStore.getIncomingWebhooks(teamId)
        });
    }

    handleUserChange() {
        this.setState({
            users: UserStore.getProfiles()
        });
    }

    deleteIncomingWebhook(incomingWebhook) {
        deleteIncomingHook(incomingWebhook.id);
    }

    incomingWebhookCompare(a, b) {
        let displayNameA = a.display_name;
        if (!displayNameA) {
            const channelA = ChannelStore.get(a.channel_id);
            if (channelA) {
                displayNameA = channelA.display_name;
            } else {
                displayNameA = Utils.localizeMessage('installed_incoming_webhooks.unknown_channel', 'A Private Webhook');
            }
        }

        let displayNameB = b.display_name;
        if (!displayNameB) {
            const channelB = ChannelStore.get(b.channel_id);
            if (channelB) {
                displayNameB = channelB.display_name;
            } else {
                displayNameB = Utils.localizeMessage('installed_incoming_webhooks.unknown_channel', 'A Private Webhook');
            }
        }

        return displayNameA.localeCompare(displayNameB);
    }

    render() {
        const incomingWebhooks = this.state.incomingWebhooks.sort(this.incomingWebhookCompare).map((incomingWebhook) => {
            const canChange = this.props.isAdmin || this.props.user.id === incomingWebhook.user_id;

            return (
                <InstalledIncomingWebhook
                    key={incomingWebhook.id}
                    incomingWebhook={incomingWebhook}
                    onDelete={this.deleteIncomingWebhook}
                    creator={this.state.users[incomingWebhook.user_id] || {}}
                    canChange={canChange}
                    team={this.props.team}
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
                        defaultMessage='Use incoming webhooks to connect external tools to Mattermost. {buildYourOwn} or visit the {appDirectory} to find self-hosted, third-party apps and integrations.'
                        values={{
                            buildYourOwn: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='http://docs.mattermost.com/developer/webhooks-incoming.html'
                                >
                                    <FormattedMessage
                                        id='installed_incoming_webhooks.help.buildYourOwn'
                                        defaultMessage='Build your own'
                                    />
                                </a>
                            ),
                            appDirectory: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='https://about.mattermost.com/default-app-directory/'
                                >
                                    <FormattedMessage
                                        id='installed_incoming_webhooks.help.appDirectory'
                                        defaultMessage='App Directory'
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
