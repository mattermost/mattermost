// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import DeleteIntegration from './delete_integration.jsx';

import {getSiteURL} from 'utils/url.jsx';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router';

export default class InstalledIncomingWebhook extends React.PureComponent {
    static propTypes = {

        /**
        * Data used for showing webhook details
        */
        incomingWebhook: PropTypes.object.isRequired,

        /**
        * Function to call when webhook delete button is pressed
        */
        onDelete: PropTypes.func.isRequired,

        /**
        * String used for filtering webhook item
        */
        filter: PropTypes.string,

        /**
        * Data used for showing created by details
        */
        creator: PropTypes.object.isRequired,

        /**
        *  Set to show available actions on webhook
        */
        canChange: PropTypes.bool.isRequired,

        /**
        *  Data used in routing of webhook for modifications
        */
        team: PropTypes.object.isRequired,

        /**
        *  Data used for filtering of webhook based on filter prop
        */
        channel: PropTypes.object
    }

    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
    }

    handleDelete() {
        this.props.onDelete(this.props.incomingWebhook);
    }

    static matchesFilter(incomingWebhook, channel, filter) {
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

    render() {
        const incomingWebhook = this.props.incomingWebhook;
        const channel = this.props.channel;
        const filter = this.props.filter ? this.props.filter.toLowerCase() : '';

        if (!InstalledIncomingWebhook.matchesFilter(incomingWebhook, channel, filter)) {
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
                    <DeleteIntegration
                        messageId='installed_incoming_webhooks.delete.confirm'
                        onDelete={this.handleDelete}
                    />
                </div>
            );
        }

        return (
            <div className='backstage-list__item'>
                <div className='item-details'>
                    <div className='item-details__row'>
                        <span className='item-details__name'>
                            {displayName}
                        </span>
                    </div>
                    {description}
                    <div className='item-details__row'>
                        <span className='item-details__url'>
                            <FormattedMessage
                                id='installed_integrations.url'
                                defaultMessage='URL: {url}'
                                values={{
                                    url: getSiteURL() + '/hooks/' + incomingWebhook.id
                                }}
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__creation'>
                            <FormattedMessage
                                id='installed_integrations.creation'
                                defaultMessage='Created by {creator} on {createAt, date, full}'
                                values={{
                                    creator: this.props.creator.username,
                                    createAt: incomingWebhook.create_at
                                }}
                            />
                        </span>
                    </div>
                </div>
                {actions}
            </div>
        );
    }
}
