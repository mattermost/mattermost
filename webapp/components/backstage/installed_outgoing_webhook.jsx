// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ChannelStore from 'stores/channel_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class InstalledOutgoingWebhook extends React.Component {
    static get propTypes() {
        return {
            outgoingWebhook: React.PropTypes.object.isRequired,
            onRegenToken: React.PropTypes.func.isRequired,
            onDelete: React.PropTypes.func.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleRegenToken = this.handleRegenToken.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
    }

    handleRegenToken(e) {
        e.preventDefault();

        this.props.onRegenToken(this.props.outgoingWebhook);
    }

    handleDelete(e) {
        e.preventDefault();

        this.props.onDelete(this.props.outgoingWebhook);
    }

    render() {
        const outgoingWebhook = this.props.outgoingWebhook;

        const channel = ChannelStore.get(outgoingWebhook.channel_id);
        const channelName = channel ? channel.display_name : 'cannot find channel';

        return (
            <div className='installed-integrations__item installed-integrations__outgoing-webhook'>
                <div className='details'>
                    <div className='details-row'>
                        <span className='name'>
                            {channelName}
                        </span>
                        <span className='type'>
                            <FormattedMessage
                                id='installed_integrations.outgoingWebhookType'
                                defaultMessage='(Outgoing Webhook)'
                            />
                        </span>
                    </div>
                    <div className='details-row'>
                        <span className='description'>
                            {Utils.getWindowLocationOrigin() + '/hooks/' + outgoingWebhook.id}
                            {' - '}
                            {outgoingWebhook.token}
                        </span>
                    </div>
                </div>
                <div className='actions'>
                    <a
                        href='#'
                        onClick={this.handleRegenToken}
                    >
                        <FormattedMessage
                            id='installed_integrations.regenToken'
                            defaultMessage='Regen Token'
                        />
                    </a>
                    {' - '}
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
