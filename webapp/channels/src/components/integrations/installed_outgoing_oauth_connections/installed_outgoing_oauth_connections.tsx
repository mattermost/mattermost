// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import BackstageList from 'components/backstage/components/backstage_list';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {DeveloperLinks} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import InstalledOutgoingOAuthConnection from '../installed_outgoing_oauth_connection';
import {matchesFilter} from '../installed_outgoing_oauth_connection/installed_outgoing_oauth_connection';

type Props = {

    /**
    * The team data
    */
    team: {name: string};

    /**
    * The outgoingOauthConnections data
    */
    outgoingOAuthConnections: {
        [key: string]: OutgoingOAuthConnection;
    };

    /**
    * Set if user can manage oath
    */
    canManageOauth: boolean;

    /**
    * Whether or not OAuth applications are enabled.
    */
    enableOAuthServiceProvider: boolean;

    actions: ({
        loadOutgoingOAuthConnectionsAndProfiles: (page?: number, perPage?: number) => Promise<void>;

        /**
        * The function to call when Regenerate Secret link is clicked
        */
        regenOutgoingOAuthConnectionSecret: (connectionId: string) => Promise<{ error?: Error }>;

        /**
        * The function to call when Delete link is clicked
        */
        deleteOutgoingOAuthConnection: (connectionId: string) => Promise<void>;
    });
};

type State = {
    loading: boolean;
};

export default class InstalledOutgoingOAuthConnections extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            loading: true,
        };
    }

    componentDidMount(): void {
        if (this.props.enableOAuthServiceProvider) {
            this.props.actions.loadOutgoingOAuthConnectionsAndProfiles().then(
                () => this.setState({loading: false}),
            );
        }
    }

    deleteOutgoingOAuthConnection = (connection: OutgoingOAuthConnection): void => {
        if (connection && connection.id) {
            this.props.actions.deleteOutgoingOAuthConnection(connection.id);
        }
    };

    outgoingOauthConnectionCompare(a: OutgoingOAuthConnection, b: OutgoingOAuthConnection): number {
        let nameA = a.name.toString();
        if (!nameA) {
            nameA = localizeMessage('installed_integrations.unnamed_outgoing_oauth_connection', 'Unnamed Outgoing OAuth Connection');
        }

        let nameB = b.name.toString();
        if (!nameB) {
            nameB = localizeMessage('installed_integrations.unnamed_outgoing_oauth_connection', 'Unnamed Outgoing OAuth Connection');
        }

        return nameA.localeCompare(nameB);
    }

    outgoingOauthConnections = (filter?: string) => {
        const values = Object.values(this.props.outgoingOAuthConnections);
        const filtered = values.filter((connection) => matchesFilter(connection, filter));
        const sorted = filtered.sort(this.outgoingOauthConnectionCompare);
        const mapped = sorted.map((connection) => {
            return (
                <InstalledOutgoingOAuthConnection
                    key={connection.id}
                    outgoingOAuthConnection={connection}
                    onRegenerateSecret={this.props.actions.regenOutgoingOAuthConnectionSecret}
                    onDelete={this.deleteOutgoingOAuthConnection}
                    team={this.props.team}
                    creatorName=''
                />
            );
        });

        return mapped;
    };

    render(): JSX.Element {
        const integrationsEnabled = this.props.enableOAuthServiceProvider && this.props.canManageOauth;
        let props;
        if (integrationsEnabled) {
            props = {
                addLink: '/' + this.props.team.name + '/integrations/outgoing-oauth2-connections/add',
                addText: localizeMessage('installed_outgoing_oauth_connections.add', 'Add Outgoing OAuth Connection'),
                addButtonId: 'addOutgoingOauthConnection',
            };
        }

        return (
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_outgoing_oauth_connections.header'
                        defaultMessage='Outgoing OAuth Connections'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_outgoing_oauth_connections.help'
                        defaultMessage='Create {outgoingOauthConnections} to securely integrate bots and third-party apps with Mattermost.'
                        values={{
                            outgoingOauthConnections: (
                                <ExternalLink
                                    href={DeveloperLinks.SETUP_OAUTH2}
                                    location='installed_outgoing_oauth_connections'
                                >
                                    <FormattedMessage
                                        id='installed_outgoing_oauth_connections.help.outgoingOauthConnections'
                                        defaultMessage='Outgoing OAuth Connections'
                                    />
                                </ExternalLink>
                            ),
                        }}
                    />
                }
                emptyText={
                    <FormattedMessage
                        id='installed_outgoing_oauth_connections.empty'
                        defaultMessage='No Outgoing OAuth Connections found'
                    />
                }
                emptyTextSearch={
                    <FormattedMarkdownMessage
                        id='installed_outgoing_oauth_connections.emptySearch'
                        defaultMessage='No Outgoing OAuth Connections match {searchTerm}'
                    />
                }
                searchPlaceholder={localizeMessage('installed_outgoing_oauth_connections.search', 'Search Outgoing OAuth Connections')}
                loading={this.state.loading}
                {...props}
            >
                {(filter: string) => {
                    const children = this.outgoingOauthConnections(filter);
                    return [children, children.length > 0];
                }}
            </BackstageList>
        );
    }
}
