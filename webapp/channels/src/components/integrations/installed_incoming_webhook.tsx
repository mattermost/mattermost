// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';
import type {IncomingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import CopyText from 'components/copy_text';

import {getSiteURL} from 'utils/url';

import DeleteIntegrationLink from './delete_integration_link';

export function matchesFilter(incomingWebhook: IncomingWebhook, channel: Channel, filter: string) {
    if (!filter) {
        return true;
    }

    if (incomingWebhook.display_name.toLowerCase().indexOf(filter) !== -1 ||
        incomingWebhook.description.toLowerCase().indexOf(filter) !== -1) {
        return true;
    }

    if (incomingWebhook.channel_id) {
        if (channel && channel.name.toLowerCase().indexOf(filter) !== -1) {
            return true;
        }
    }

    return false;
}

type Props = {

    /**
     * Data used for showing webhook details
     */
    incomingWebhook: IncomingWebhook;

    /**
     * Function to call when webhook delete button is pressed
     */
    onDelete: (incomingWebhook: IncomingWebhook) => void;

    /**
     * String used for filtering webhook item
     */
    filter?: string;

    /**
     * Data used for showing created by details
     */
    creator: {
        username: string;
    };

    /**
     *  Set to show available actions on webhook
     */
    canChange: boolean;

    /**
     *  Data used in routing of webhook for modifications
     */
    team: Team;

    /**
     *  Data used for filtering of webhook based on filter prop
     */
    channel: Channel;
}

export default class InstalledIncomingWebhook extends React.PureComponent<Props> {
    handleDelete = () => {
        this.props.onDelete(this.props.incomingWebhook);
    };

    render() {
        const incomingWebhook = this.props.incomingWebhook;
        const channel = this.props.channel;
        const filter = this.props.filter ? this.props.filter.toLowerCase() : '';

        if (!matchesFilter(incomingWebhook, channel, filter)) {
            return null;
        }

        let displayName;
        if (incomingWebhook.display_name) {
            displayName = incomingWebhook.display_name;
        } else if (channel) {
            displayName = channel.display_name;
        } else {
            displayName = (
                <FormattedMessage
                    id='installed_incoming_webhooks.unknown_channel'
                    defaultMessage='A Private Webhook'
                />
            );
        }

        let description = null;
        if (incomingWebhook.description) {
            description = (
                <div className='item-details__row'>
                    <span className='item-details__description'>
                        {incomingWebhook.description}
                    </span>
                </div>
            );
        }

        let actions = null;
        if (this.props.canChange) {
            actions = (
                <div className='item-actions'>
                    <Link to={`/${this.props.team.name}/integrations/incoming_webhooks/edit?id=${incomingWebhook.id}`}>
                        <FormattedMessage
                            id='installed_integrations.edit'
                            defaultMessage='Edit'
                        />
                    </Link>
                    {' - '}
                    <DeleteIntegrationLink
                        modalMessage={
                            <FormattedMessage
                                id='installed_incoming_webhooks.delete.confirm'
                                defaultMessage='This action permanently deletes the incoming webhook and breaks any integrations using it. Are you sure you want to delete it?'
                            />
                        }
                        onDelete={this.handleDelete}
                    />
                </div>
            );
        }

        const incomingWebhookId = getSiteURL() + '/hooks/' + incomingWebhook.id;

        return (
            <div className='backstage-list__item'>
                <div className='item-details'>
                    <div className='item-details__row d-flex flex-column flex-md-row justify-content-between'>
                        <strong className='item-details__name'>
                            {displayName}
                        </strong>
                        {actions}
                    </div>
                    {description}
                    <div className='item-details__row'>
                        <span className='item-details__url word-break--all'>
                            <FormattedMessage
                                id='installed_integrations.url'
                                defaultMessage='URL: {url}'
                                values={{
                                    url: incomingWebhookId,
                                }}
                            />
                            <span>
                                <CopyText
                                    label={defineMessage({
                                        id: 'integrations.copy_url',
                                        defaultMessage: 'Copy URL',
                                    })}
                                    value={incomingWebhookId}
                                />
                            </span>
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__creation'>
                            <FormattedMessage
                                id='installed_integrations.creation'
                                defaultMessage='Created by {creator} on {createAt, date, full}'
                                values={{
                                    creator: this.props.creator.username,
                                    createAt: incomingWebhook.create_at,
                                }}
                            />
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}
