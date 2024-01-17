// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import CopyText from 'components/copy_text';
import FormError from 'components/form_error';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import DeleteIntegrationLink from '../delete_integration_link';

const FAKE_SECRET = '***************';

export function matchesFilter(outgoingOAuthConnection: OutgoingOAuthConnection, filter?: string | null): boolean {
    if (!filter) {
        return true;
    }

    return outgoingOAuthConnection.name.toLowerCase().includes(filter);
}

export type InstalledOutgoingOAuthConnectionProps = {
    team: Partial<Team>;
    outgoingOAuthConnection: OutgoingOAuthConnection;
    creatorName: string;
    filter?: string | null;

    onRegenerateSecret: (outgoingOAuthConnectionId: string) => Promise<{error?: {message: string}}>;
    onDelete: (outgoingOAuthConnection: OutgoingOAuthConnection) => void;
}

export type InstalledOutgoingOAuthConnectionState = {
    clientSecret: string;
    error?: string | null;
}

const InstalledOutgoingOAuthConnection = (props: InstalledOutgoingOAuthConnectionProps) => {
    const [storedError, setError] = useState<string | null>(null);

    const handleDelete = (): void => {
        props.onDelete(props.outgoingOAuthConnection);
        setError(''); // TODO check for error here
    };

    const {outgoingOAuthConnection, creatorName} = props;
    let errorComponent;

    if (storedError) {
        errorComponent = (
            <FormError
                error={storedError}
            />
        );
    }

    if (!matchesFilter(outgoingOAuthConnection, props.filter)) {
        return null;
    }

    let name;
    if (outgoingOAuthConnection.name) {
        name = outgoingOAuthConnection.name;
    } else {
        name = (
            <FormattedMessage
                id='installed_integrations.unnamed_outgoing_oauth_connection'
                defaultMessage='Unnamed Outgoing OAuth Connection'
            />
        );
    }

    const urls = (
        <>
            <div className='item-details__row'>
                <span className='item-details__url word-break--all'>
                    <FormattedMessage
                        id='installed_integrations.audience_urls'
                        defaultMessage='Audience URLs: {urls}'
                        values={{
                            urls: outgoingOAuthConnection.audiences.join(', '),
                        }}
                    />
                </span>
            </div>
            <div className='item-details__row'>
                <span className='item-details__url word-break--all'>
                    <FormattedMessage
                        id='installed_integrations.token_url'
                        defaultMessage='Token URL: {url}'
                        values={{
                            url: outgoingOAuthConnection.oauth_token_url,
                        }}
                    />
                </span>
            </div>
        </>
    );

    const actions = (
        <div className='item-actions'>
            <Link to={`/${props.team.name}/integrations/outgoing-oauth2-connections/edit?id=${outgoingOAuthConnection.id}`}>
                <FormattedMessage
                    id='installed_integrations.edit'
                    defaultMessage='Edit'
                />
            </Link>
            {' - '}
            <DeleteIntegrationLink
                modalMessage={
                    <FormattedMessage
                        id='installed_outgoing_oauth_connections.delete.confirm'
                        defaultMessage='This action deletes the OAuth 2.0 connection and breaks any integrations using it. Are you sure you want to delete it?'
                    />
                }
                onDelete={handleDelete}
            />
        </div>
    );

    const connectionInfo = (
        <>
            <div className='item-details__row'>
                <span className='item-details__token'>
                    <FormattedMarkdownMessage
                        id='installed_integrations.client_id'
                        defaultMessage='Client ID: **{clientId}**'
                        values={{
                            clientId: outgoingOAuthConnection.client_id,
                        }}
                    />
                </span>
            </div>
            <div className='item-details__row'>
                <span className='item-details__token'>
                    <FormattedMessage
                        id='installed_outgoing_oauth_connections.client_secret'
                        defaultMessage='Client Secret: ********'
                    />
                </span>
            </div>
            {outgoingOAuthConnection.grant_type === 'password' && (
                <>
                    <div className='item-details__row'>
                        <span className='item-details__token'>
                            <FormattedMarkdownMessage
                                id='installed_outgoing_oauth_connections.username'
                                defaultMessage='Username: **{username}**'
                                values={{
                                    username: outgoingOAuthConnection.credentials_username,
                                }}
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__token'>
                            <FormattedMessage
                                id='installed_outgoing_oauth_connections.password'
                                defaultMessage='Password: ********'
                            />
                        </span>
                    </div>
                </>
            )}

            {urls}
            <div className='item-details__row'>
                <span className='item-details__creation'>
                    <FormattedMessage
                        id='installed_integrations.creation'
                        defaultMessage='Created by {creator} on {createAt, date, full}'
                        values={{
                            creator: creatorName,
                            createAt: outgoingOAuthConnection.create_at,
                        }}
                    />
                </span>
            </div>
        </>
    );

    return (
        <div className='backstage-list__item' >
            <div className='item-details' >
                <div className='item-details__row d-flex flex-column flex-md-row justify-content-between'>
                    <strong className='item-details__name'>
                        {name}
                    </strong>
                    {actions}
                </div>
                {errorComponent}
                {connectionInfo}
            </div>
        </div >
    );
};

export default InstalledOutgoingOAuthConnection;
