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
            onDelete: React.PropTypes.func.isRequired
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

    render() {
        const incomingWebhook = this.props.incomingWebhook;

        const channel = ChannelStore.get(incomingWebhook.channel_id);
        const channelName = channel ? channel.display_name : 'cannot find channel';

        return (
            <div className='backstage-list__item'>
                <div className='item-details'>
                    <div className='item-details__row'>
                        <span className='item-details__name'>
                            {incomingWebhook.display_name || channelName}
                        </span>
                        <span className='item-details__type'>
                            <FormattedMessage
                                id='installed_integrations.incomingWebhookType'
                                defaultMessage='(Incoming Webhook)'
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__description'>
                            {incomingWebhook.description}
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

    static matches(incomingWebhook, filter) {
        if (incomingWebhook.display_name.toLowerCase().indexOf(filter) !== -1 ||
            incomingWebhook.description.toLowerCase().indexOf(filter) !== -1) {
            return true;
        }

        if (incomingWebhook.channel_id) {
            const channel = ChannelStore.get(incomingWebhook.channel_id);

            if (channel && channel.name.toLowerCase().indexOf(filter) !== -1) {
                return true;
            }
        }

        return false;
    }
}
