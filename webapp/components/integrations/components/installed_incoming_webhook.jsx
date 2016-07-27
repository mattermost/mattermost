// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ChannelStore from 'stores/channel_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class InstalledIncomingWebhook extends React.Component {
    static get propTypes() {
        return {
            incomingWebhook: React.PropTypes.object.isRequired,
            onDelete: React.PropTypes.func.isRequired,
            filter: React.PropTypes.string
        };
    }

    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
    }

    handleDelete(e) {
        e.preventDefault();

        this.props.onDelete(this.props.incomingWebhook);
    }

    matchesFilter(incomingWebhook, channel, filter) {
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
        const channel = ChannelStore.get(incomingWebhook.channel_id);
        const filter = this.props.filter ? this.props.filter.toLowerCase() : '';

        if (!this.matchesFilter(incomingWebhook, channel, filter)) {
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
                                    url: window.mm_config.SiteURL + '/hooks/' + incomingWebhook.id
                                }}
                            />
                        </span>
                    </div>
                    <div className='tem-details__row'>
                        <span className='item-details__creation'>
                            <FormattedMessage
                                id='installed_integrations.creation'
                                defaultMessage='Created by {creator} on {createAt, date, full}'
                                values={{
                                    creator: Utils.displayUsername(incomingWebhook.user_id),
                                    createAt: incomingWebhook.create_at
                                }}
                            />
                        </span>
                    </div>
                </div>
                <div className='item-actions'>
                    <a
                        href='#'
                        onClick={this.handleDelete}
                    >
                        <FormattedMessage
                            id='installed_integrations.delete'
                            defaultMessage='Delete'
                        />
                    </a>
                </div>
            </div>
        );
    }
}
