// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import {Permissions} from 'mattermost-redux/constants';

import ExternalLink from 'components/external_link';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';

import BotAccountsIcon from 'images/bot_default_icon.png';
import IncomingWebhookIcon from 'images/incoming_webhook.jpg';
import OAuthIcon from 'images/oauth_icon.png';
import OutgoingOAuthConnectionsIcon from 'images/outgoing_oauth_connection.png';
import OutgoingWebhookIcon from 'images/outgoing_webhook.jpg';
import SlashCommandIcon from 'images/slash_command_icon.jpg';
import * as Utils from 'utils/utils';

import IntegrationOption from './integration_option';

type Props = {
    siteName: string | undefined;
    enableIncomingWebhooks: boolean;
    enableOutgoingWebhooks: boolean;
    enableCommands: boolean;
    enableOAuthServiceProvider: boolean;
    enableOutgoingOAuthConnections: boolean;
    team: Team;
}

export default class Integrations extends React.PureComponent <Props> {
    componentDidMount() {
        this.updateTitle();
    }

    updateTitle = () => {
        const currentSiteName = this.props.siteName || '';
        document.title = Utils.localizeMessage('admin.sidebar.integrations', 'Integrations') + ' - ' + this.props.team.display_name + ' ' + currentSiteName;
    };

    render() {
        const options = [];

        if (this.props.enableIncomingWebhooks) {
            options.push(
                <TeamPermissionGate
                    teamId={this.props.team.id}
                    permissions={[Permissions.MANAGE_INCOMING_WEBHOOKS]}
                    key='incomingWebhookPermission'
                >
                    <IntegrationOption
                        key='incomingWebhook'
                        image={IncomingWebhookIcon}
                        title={
                            <FormattedMessage
                                id='integrations.incomingWebhook.title'
                                defaultMessage='Incoming Webhooks'
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
                </TeamPermissionGate>,
            );
        }

        if (this.props.enableOutgoingWebhooks) {
            options.push(
                <TeamPermissionGate
                    teamId={this.props.team.id}
                    permissions={[Permissions.MANAGE_OUTGOING_WEBHOOKS]}
                    key='outgoingWebhookPermission'
                >
                    <IntegrationOption
                        key='outgoingWebhook'
                        image={OutgoingWebhookIcon}
                        title={
                            <FormattedMessage
                                id='integrations.outgoingWebhook.title'
                                defaultMessage='Outgoing Webhooks'
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
                </TeamPermissionGate>,
            );
        }

        if (this.props.enableCommands) {
            options.push(
                <TeamPermissionGate
                    teamId={this.props.team.id}
                    permissions={[Permissions.MANAGE_SLASH_COMMANDS]}
                    key='commandPermission'
                >
                    <IntegrationOption
                        key='command'
                        image={SlashCommandIcon}
                        title={
                            <FormattedMessage
                                id='integrations.command.title'
                                defaultMessage='Slash Commands'
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
                </TeamPermissionGate>,
            );
        }

        if (this.props.enableOAuthServiceProvider) {
            options.push(
                <SystemPermissionGate
                    permissions={[Permissions.MANAGE_OAUTH]}
                    key='oauth2AppsPermission'
                >
                    <IntegrationOption
                        key='oauth2Apps'
                        image={OAuthIcon}
                        title={
                            <FormattedMessage
                                id='integrations.oauthApps.title'
                                defaultMessage='OAuth 2.0 Applications'
                            />
                        }
                        description={
                            <FormattedMessage
                                id='integrations.oauthApps.description'
                                defaultMessage='Auth 2.0 allows external applications to make authorized requests to the Mattermost API'
                            />
                        }
                        link={'/' + this.props.team.name + '/integrations/oauth2-apps'}
                    />
                </SystemPermissionGate>,
            );
        }

        if (this.props.enableOutgoingOAuthConnections) {
            options.push(
                <TeamPermissionGate
                    teamId={this.props.team.id}
                    permissions={[Permissions.MANAGE_OUTGOING_OAUTH_CONNECTIONS]}
                    key='outgoingOAuthConnectionsPermission'
                >
                    <IntegrationOption
                        key='outgoingOAuthConnections'
                        image={OutgoingOAuthConnectionsIcon}
                        title={
                            <FormattedMessage
                                id='integrations.outgoingOAuthConnections.title'
                                defaultMessage='Outgoing OAuth Connections'
                            />
                        }
                        description={
                            <FormattedMessage
                                id='integrations.outgoingOAuthConnections.description'
                                defaultMessage='Outgoing OAuth Connections allow custom integrations to communicate to external systems'
                            />
                        }
                        link={'/' + this.props.team.name + '/integrations/outgoing-oauth2-connections'}
                    />
                </TeamPermissionGate>,
            );
        }

        options.push(
            <SystemPermissionGate
                permissions={['manage_bots']}
                key='botsPermissions'
            >
                <IntegrationOption
                    image={BotAccountsIcon}
                    title={
                        <FormattedMessage
                            id='bots.manage.header'
                            defaultMessage='Bot Accounts'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='bots.manage.description'
                            defaultMessage='Use bot accounts to integrate with Mattermost through plugins or the API'
                        />
                    }
                    link={'/' + this.props.team.name + '/integrations/bots'}
                />
            </SystemPermissionGate>,
        );

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
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id='integrations.help'
                        defaultMessage='Visit the {appDirectory} to find self-hosted, third-party apps and integrations for Mattermost.'
                        values={{
                            appDirectory: (
                                <ExternalLink
                                    href='https://mattermost.com/marketplace'
                                    location='integrations'
                                >
                                    <FormattedMessage
                                        id='integrations.help.appDirectory'
                                        defaultMessage='App Directory'
                                    />
                                </ExternalLink>
                            ),
                        }}
                    />
                </div>
                <div className='integrations-list d-flex flex-wrap'>
                    {options}
                </div>
            </div>
        );
    }
}
