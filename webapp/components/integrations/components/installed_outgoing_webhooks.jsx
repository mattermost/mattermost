// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import InstalledOutgoingWebhook from './installed_outgoing_webhook.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {loadOutgoingHooksForTeam, regenOutgoingHookToken, deleteOutgoingHook} from 'actions/integration_actions.jsx';

import * as Utils from 'utils/utils.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class InstalledOutgoingWebhooks extends React.Component {
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
        this.regenOutgoingWebhookToken = this.regenOutgoingWebhookToken.bind(this);
        this.deleteOutgoingWebhook = this.deleteOutgoingWebhook.bind(this);

        const teamId = TeamStore.getCurrentId();

        this.state = {
            outgoingWebhooks: IntegrationStore.getOutgoingWebhooks(teamId),
            loading: !IntegrationStore.hasReceivedOutgoingWebhooks(teamId),
            users: UserStore.getProfiles()
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);
        UserStore.addChangeListener(this.handleUserChange);

        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
            loadOutgoingHooksForTeam(TeamStore.getCurrentId(), () => this.setState({loading: false}));
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
        UserStore.removeChangeListener(this.handleUserChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            outgoingWebhooks: IntegrationStore.getOutgoingWebhooks(teamId)
        });
    }

    handleUserChange() {
        this.setState({users: UserStore.getProfiles()});
    }

    regenOutgoingWebhookToken(outgoingWebhook) {
        regenOutgoingHookToken(outgoingWebhook.id);
    }

    deleteOutgoingWebhook(outgoingWebhook) {
        deleteOutgoingHook(outgoingWebhook.id);
    }

    outgoingWebhookCompare(a, b) {
        let displayNameA = a.display_name;
        if (!displayNameA) {
            const channelA = ChannelStore.get(a.channel_id);
            if (channelA) {
                displayNameA = channelA.display_name;
            } else {
                displayNameA = Utils.localizeMessage('installed_outgoing_webhooks.unknown_channel', 'A Private Webhook');
            }
        }

        let displayNameB = b.display_name;
        if (!displayNameB) {
            const channelB = ChannelStore.get(b.channel_id);
            if (channelB) {
                displayNameB = channelB.display_name;
            } else {
                displayNameB = Utils.localizeMessage('installed_outgoing_webhooks.unknown_channel', 'A Private Webhook');
            }
        }

        return displayNameA.localeCompare(displayNameB);
    }

    render() {
        const outgoingWebhooks = this.state.outgoingWebhooks.sort(this.outgoingWebhookCompare).map((outgoingWebhook) => {
            const canChange = this.props.isAdmin || this.props.user.id === outgoingWebhook.creator_id;

            return (
                <InstalledOutgoingWebhook
                    key={outgoingWebhook.id}
                    outgoingWebhook={outgoingWebhook}
                    onRegenToken={this.regenOutgoingWebhookToken}
                    onDelete={this.deleteOutgoingWebhook}
                    creator={this.state.users[outgoingWebhook.creator_id] || {}}
                    canChange={canChange}
                    team={this.props.team}
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
                        defaultMessage='Use outgoing webhooks to connect external tools to Mattermost. {buildYourOwn} or visit the {appDirectory} to find self-hosted, third-party apps and integrations.'
                        values={{
                            buildYourOwn: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='http://docs.mattermost.com/developer/webhooks-outgoing.html'
                                >
                                    <FormattedMessage
                                        id='installed_outgoing_webhooks.help.buildYourOwn'
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
                                        id='installed_outgoing_webhooks.help.appDirectory'
                                        defaultMessage='App Directory'
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
