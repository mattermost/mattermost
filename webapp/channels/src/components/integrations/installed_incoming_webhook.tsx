// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';
import {FormattedMessage, injectIntl} from 'react-intl';
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

    if (incomingWebhook.channel_id && channel) {
        const filterLower = filter.toLowerCase();
        const channelMatches = channel.name.toLowerCase().includes(filterLower) || channel.display_name.toLowerCase().includes(filterLower);

        if (channelMatches) {
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
    intl: IntlShape;
}

class InstalledIncomingWebhook extends React.PureComponent<Props> {
    handleDelete = () => {
        this.props.onDelete(this.props.incomingWebhook);
    };

    render() {
        const incomingWebhook = this.props.incomingWebhook;
        const channel = this.props.channel;
        const filter = this.props.filter ? this.props.filter.toLowerCase() : '';
        const intl = this.props.intl;

        if (!matchesFilter(incomingWebhook, channel, filter)) {
            return null;
        }

        let displayName;
        if (incomingWebhook.display_name) {
            displayName = incomingWebhook.display_name;
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

        const incomingWebhookIdValue = getSiteURL() + '/hooks/' + incomingWebhook.id;
        const incomingWebhookId = intl.formatMessage(
            {
                id: 'installed_integrations.url',
                defaultMessage: 'URL: {url}',
            },
            {url: incomingWebhookIdValue},
        );

        let channelDisplayName;
        if (channel.display_name) {
            channelDisplayName = intl.formatMessage(
                {
                    id: 'installed_integrations.channel_name',
                    defaultMessage: 'Channel: {name}',
                },
                {name: channel.display_name},
            );
        } else {
            channelDisplayName = intl.formatMessage(
                {
                    id: 'installed_integrations.channel_name_empty',
                    defaultMessage: 'N/A',
                },
            );
        }

        const itemCreation = intl.formatMessage(
            {
                id: 'installed_integrations.creation',
                defaultMessage: 'Created by {creator} on {createAt, date, full}',
            },
            {
                creator: this.props.creator.username,
                createAt: incomingWebhook.create_at,
            },
        );

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
                            {incomingWebhookId}
                            <CopyText
                                value={incomingWebhookIdValue}
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__channel_name word-break--all'>
                            {channelDisplayName}
                            <CopyText
                                value={channelDisplayName}
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__creation'>
                            {itemCreation}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}

export default injectIntl(InstalledIncomingWebhook);
