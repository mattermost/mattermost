// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import {deleteOutgoingOAuthConnection} from 'mattermost-redux/actions/integrations';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getOutgoingOAuthConnections} from 'mattermost-redux/selectors/entities/integrations';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';

import {loadOutgoingOAuthConnectionsAndProfiles} from 'actions/integration_actions';

import BackstageList from 'components/backstage/components/backstage_list';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {DeveloperLinks} from 'utils/constants';

import type {GlobalState} from 'types/store';

import InstalledOutgoingOAuthConnection, {matchesFilter} from './installed_outgoing_oauth_connection';

type Props = {
    team: Team;
};

const InstalledOutgoingOAuthConnections = (props: Props) => {
    const [loading, setLoading] = useState(true);
    const canManageOutgoingOAuthConnections = useSelector((state) => haveITeamPermission(state as GlobalState, props.team.id, Permissions.MANAGE_OUTGOING_OAUTH_CONNECTIONS));
    const enableOutgoingOAuthConnections = (useSelector(getConfig).EnableOutgoingOAuthConnections === 'true');
    const connections = useSelector(getOutgoingOAuthConnections);

    const dispatch = useDispatch();
    const intl = useIntl();

    useEffect(() => {
        if (canManageOutgoingOAuthConnections) {
            (dispatch(loadOutgoingOAuthConnectionsAndProfiles(props.team.id)) as unknown as Promise<void>).then(
                () => setLoading(false),
            );
        }
    }, [canManageOutgoingOAuthConnections, props.team, dispatch]);

    const deleteOutgoingOAuthConnectionLocal = (connection: OutgoingOAuthConnection): void => {
        if (connection && connection.id) {
            dispatch(deleteOutgoingOAuthConnection(connection.id));
        }
    };

    const outgoingOauthConnectionCompare = (a: OutgoingOAuthConnection, b: OutgoingOAuthConnection): number => {
        let nameA = a.name.toString();
        if (!nameA) {
            nameA = intl.formatMessage({id: 'installed_integrations.unnamed_outgoing_oauth_connection', defaultMessage: 'Unnamed Outgoing OAuth Connection'});
        }

        let nameB = b.name.toString();
        if (!nameB) {
            nameB = intl.formatMessage({id: 'installed_integrations.unnamed_outgoing_oauth_connection', defaultMessage: 'Unnamed Outgoing OAuth Connection'});
        }

        return nameA.localeCompare(nameB);
    };

    const outgoingOauthConnections = (filter?: string) => {
        const values = Object.values(connections);
        const filtered = values.filter((connection) => matchesFilter(connection, filter));
        const sorted = filtered.sort(outgoingOauthConnectionCompare);
        const mapped = sorted.map((connection) => {
            return (
                <InstalledOutgoingOAuthConnection
                    key={connection.id}
                    outgoingOAuthConnection={connection}
                    onDelete={deleteOutgoingOAuthConnectionLocal}
                    team={props.team}
                    creatorName=''
                />
            );
        });

        return mapped;
    };

    const integrationsEnabled = enableOutgoingOAuthConnections && canManageOutgoingOAuthConnections;
    let childProps;
    if (integrationsEnabled) {
        childProps = {
            addLink: '/' + props.team.name + '/integrations/outgoing-oauth2-connections/add',
            addText: intl.formatMessage({id: 'installed_outgoing_oauth_connections.add', defaultMessage: 'Add Outgoing OAuth Connection'}),
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
            searchPlaceholder={intl.formatMessage({id: 'installed_outgoing_oauth_connections.search', defaultMessage: 'Search Outgoing OAuth Connections'})}
            loading={loading}
            {...childProps}
        >
            {(filter: string) => {
                const children = outgoingOauthConnections(filter);
                return [children, children.length > 0];
            }}
        </BackstageList>
    );
};

export default InstalledOutgoingOAuthConnections;
