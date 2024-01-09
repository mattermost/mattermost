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
    const [storedClientSecret, setClientSecret] = useState(FAKE_SECRET);
    const [storedError, setError] = useState<string | null>(null);

    const handleShowClientSecret = (e?: React.MouseEvent): void => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        setClientSecret(props.outgoingOAuthConnection.client_secret);
    };

    // const handleHideClientSecret = (e: React.MouseEvent): void => {
    //     e.preventDefault();
    //     setClientSecret(FAKE_SECRET);
    // };

    const handleRegenerate = (e: React.MouseEvent): void => {
        e.preventDefault();
        props.onRegenerateSecret(props.outgoingOAuthConnection.id).then(
            ({error}) => {
                if (error) {
                    setError(error.message);
                } else {
                    setError(null);
                    handleShowClientSecret();
                }
            },
        );
    };

    const handleDelete = (): void => {
        props.onDelete(props.outgoingOAuthConnection);
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

    // let description;

    // if (outgoingOAuthConnection.description) {
    //     description = (
    //         <div className='item-details__row'>
    //             <span className='item-details__description'>
    //                 {outgoingOAuthConnection.description}
    //             </span>
    //         </div>
    //     );
    // }

    const urls = (
        <div className='item-details__row'>
            <span className='item-details__url word-break--all'>
                <FormattedMessage
                    id='installed_integrations.audience_urls'
                    defaultMessage='Audiences URLs: {urls}'
                    values={{
                        urls: outgoingOAuthConnection.audiences.join(', '),
                    }}
                />
            </span>
        </div>
    );

    // let isTrusted;

    // if (outgoingOAuthConnection.is_trusted) {
    //     isTrusted = Utils.localizeMessage('installed_outgoing_oauth_connections.trusted.yes', 'Yes');
    // } else {
    //     isTrusted = Utils.localizeMessage('installed_outgoing_oauth_connections.trusted.no', 'No');
    // }

    // let showHide;
    let clientSecretComponent;
    if (storedClientSecret === FAKE_SECRET) {
        // showHide = (
        //     <button
        //         id='showSecretButton'
        //         className='style--none color--link'
        //         onClick={handleShowClientSecret}
        //     >
        //         <FormattedMessage
        //             id='installed_integrations.showSecret'
        //             defaultMessage='Show Secret'
        //         />
        //     </button>
        // );
        clientSecretComponent = (
            <span className='item-details__token'>
                <FormattedMessage
                    id='installed_integrations.client_secret'
                    defaultMessage='Client Secret: **{clientSecret}**'
                    values={{
                        clientSecret: storedClientSecret,
                    }}
                />
            </span>
        );
    } else {
        // showHide = (
        //     <button
        //         id='hideSecretButton'
        //         className='style--none color--link'
        //         onClick={handleHideClientSecret}
        //     >
        //         <FormattedMessage
        //             id='installed_integrations.hideSecret'
        //             defaultMessage='Hide Secret'
        //         />
        //     </button>
        // );
        clientSecretComponent = (
            <span className='item-details__token'>
                <FormattedMarkdownMessage
                    id='installed_integrations.client_secret'
                    defaultMessage='Client Secret: **{clientSecret}**'
                    values={{
                        clientSecret: storedClientSecret,
                    }}
                />
                <CopyText
                    idMessage='integrations.copy_client_secret'
                    defaultMessage='Copy Client Secret'
                    value={storedClientSecret}
                />
            </span>
        );
    }

    const regen = (
        <button
            id='regenerateSecretButton'
            className='style--none color--link'
            onClick={handleRegenerate}
        >
            <FormattedMessage
                id='installed_integrations.regenSecret'
                defaultMessage='Regenerate Secret'
            />
        </button>
    );

    let icon;

    // if (outgoingOAuthConnection.icon_url) {
    //     icon = (
    //         <div className='integration__icon integration-list__icon'>
    //             <img
    //                 alt={'get connection screenshot'}
    //                 src={outgoingOAuthConnection.icon_url}
    //             />
    //         </div>
    //     );
    // }

    // let actions;

    // if (!props.fromApp) {
    const actions = (
        <div className='item-actions'>
            {/* {showHide}
                {' - '} */}
            {regen}
            {' - '}
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

    // }

    // let appInfo = (
    //     <div className='item-details__row'>
    //         <span className='item-details__creation'>
    //             <FormattedMessage
    //                 id='installed_integrations.fromApp'
    //                 defaultMessage='Managed by Apps Framework'
    //             />
    //         </span>
    //     </div>
    // );

    // if (!props.fromApp) {
    const connectionInfo = (
        <>
            {/* <div className='item-details__row'>
                    <span className='item-details__url word-break--all'>
                        <FormattedMarkdownMessage
                            id='installed_outgoing_oauth_connections.is_trusted'
                            defaultMessage='Is Trusted: **{isTrusted}**'
                            values={{
                                isTrusted,
                            }}
                        />
                    </span>
                </div> */}
            <div className='item-details__row'>
                <span className='item-details__token'>
                    <FormattedMarkdownMessage
                        id='installed_integrations.client_id'
                        defaultMessage='Client ID: **{clientId}**'
                        values={{
                            clientId: outgoingOAuthConnection.client_id,
                        }}
                    />
                    <CopyText
                        idMessage='integrations.copy_client_id'
                        defaultMessage='Copy Client Id'
                        value={outgoingOAuthConnection.client_id}
                    />
                </span>
            </div>
            <div className='item-details__row'>
                {clientSecretComponent}
            </div>
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
            {icon}
            <div className='item-details' >
                <div className='item-details__row d-flex flex-column flex-md-row justify-content-between'>
                    <strong className='item-details__name'>
                        {name}
                    </strong>
                    <span style={{marginLeft: '5px'}}/>
                    {actions}
                </div>
                {errorComponent}
                {/* {description} */}
                {connectionInfo}
            </div>
        </div >
    );
};

export default InstalledOutgoingOAuthConnection;
