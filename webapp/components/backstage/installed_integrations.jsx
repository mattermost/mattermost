// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router';

export default class InstalledIntegrations extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.setFilter = this.setFilter.bind(this);

        this.state = {
            incomingWebhooks: [],
            outgoingWebhooks: [],
            filter: ''
        };
    }

    componentWillMount() {
        IntegrationStore.addChangeListener(this.handleChange);

        if (window.mm_config.EnableIncomingWebhooks === 'true') {
            if (IntegrationStore.hasReceivedIncomingWebhooks()) {
                this.setState({
                    incomingWebhooks: IntegrationStore.getIncomingWebhooks()
                });
            } else {
                AsyncClient.listIncomingHooks();
            }
        }

        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
            if (IntegrationStore.hasReceivedOutgoingWebhooks()) {
                this.setState({
                    outgoingWebhooks: IntegrationStore.getOutgoingWebhooks()
                });
            } else {
                AsyncClient.listOutgoingHooks();
            }
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleChange);
    }

    handleChange() {
        this.setState({
            incomingWebhooks: IntegrationStore.getIncomingWebhooks(),
            outgoingWebhooks: IntegrationStore.getOutgoingWebhooks()
        });
    }

    setFilter(e, filter) {
        e.preventDefault();

        this.setState({
            filter
        });
    }

    renderTypeFilters(incomingWebhooks, outgoingWebhooks) {
        const fields = [];

        if (incomingWebhooks.length > 0 || outgoingWebhooks.length > 0) {
            let filterClassName = 'type-filter';
            if (this.state.filter === '') {
                filterClassName += ' type-filter--selected';
            }

            fields.push(
                <a
                    key='allFilter'
                    className={filterClassName}
                    href='#'
                    onClick={(e) => this.setFilter(e, '')}
                >
                    <FormattedMessage
                        id='installed_integrations.allFilter'
                        defaultMessage='All ({count})'
                        values={{
                            count: incomingWebhooks.length + outgoingWebhooks.length
                        }}
                    />
                </a>
            );
        }

        if (incomingWebhooks.length > 0) {
            fields.push(
                <span
                    key='incomingWebhooksDivider'
                    className='divider'
                >
                    {'|'}
                </span>
            );

            let filterClassName = 'type-filter';
            if (this.state.filter === 'incomingWebhooks') {
                filterClassName += ' type-filter--selected';
            }

            fields.push(
                <a
                    key='incomingWebhooksFilter'
                    className={filterClassName}
                    href='#'
                    onClick={(e) => this.setFilter(e, 'incomingWebhooks')}
                >
                    <FormattedMessage
                        id='installed_integrations.incomingWebhooksFilter'
                        defaultMessage='Incoming Webhooks ({count})'
                        values={{
                            count: incomingWebhooks.length
                        }}
                    />
                </a>
            );
        }

        if (outgoingWebhooks.length > 0) {
            fields.push(
                <span
                    key='outgoingWebhooksDivider'
                    className='divider'
                >
                    {'|'}
                </span>
            );

            let filterClassName = 'type-filter';
            if (this.state.filter === 'outgoingWebhooks') {
                filterClassName += ' type-filter--selected';
            }

            fields.push(
                <a
                    key='outgoingWebhooksFilter'
                    className={filterClassName}
                    href='#'
                    onClick={(e) => this.setFilter(e, 'outgoingWebhooks')}
                >
                    <FormattedMessage
                        id='installed_integrations.outgoingWebhooksFilter'
                        defaultMessage='Outgoing Webhooks ({count})'
                        values={{
                            count: outgoingWebhooks.length
                        }}
                    />
                </a>
            );
        }

        return (
            <div className='type-filters'>
                {fields}
            </div>
        );
    }

    render() {
        const incomingWebhooks = this.state.incomingWebhooks;
        const outgoingWebhooks = this.state.outgoingWebhooks;

        const integrations = [];
        if (!this.state.filter || this.state.filter === 'incomingWebhooks') {
            for (const incomingWebhook of incomingWebhooks) {
                integrations.push(
                    <IncomingWebhook
                        key={incomingWebhook.id}
                        incomingWebhook={incomingWebhook}
                    />
                );
            }
        }

        if (!this.state.filter || this.state.filter === 'outgoingWebhooks') {
            for (const outgoingWebhook of outgoingWebhooks) {
                integrations.push(
                    <OutgoingWebhook
                        key={outgoingWebhook.id}
                        outgoingWebhook={outgoingWebhook}
                    />
                );
            }
        }

        return (
            <div className='backstage row'>
                <div className='installed-integrations'>
                    <div className='backstage__header'>
                        <h1 className='text'>
                            <FormattedMessage
                                id='installed_integrations.header'
                                defaultMessage='Installed Integrations'
                            />
                        </h1>
                        <Link
                            className='add-integrations-link'
                            to={'/yourteamhere/integrations/add'}
                        >
                            <button
                                type='button'
                                className='btn btn-primary'
                            >
                                <span>
                                    <FormattedMessage
                                        id='installed_integrations.add'
                                        defaultMessage='Add Integration'
                                    />
                                </span>
                            </button>
                        </Link>
                    </div>
                    <div className='installed-integrations__filters'>
                        {this.renderTypeFilters(this.state.incomingWebhooks, this.state.outgoingWebhooks)}
                        <input
                            type='search'
                            placeholder={Utils.localizeMessage('installed_integrations.search', 'Search Integrations')}
                            style={{flexGrow: 0, flexShrink: 0}}
                        />
                    </div>
                    <div className='installed-integrations__list'>
                        {integrations}
                    </div>
                </div>
            </div>
        );
    }
}

function IncomingWebhook({incomingWebhook}) {
    const channel = ChannelStore.get(incomingWebhook.channel_id);
    const channelName = channel ? channel.display_name : 'cannot find channel';

    return (
        <div className='installed-integrations__item installed-integrations__incoming-webhook'>
            <div className='details'>
                <div className='details-row'>
                    <span className='name'>
                        {channelName}
                    </span>
                    <span className='type'>
                        <FormattedMessage
                            id='installed_integrations.incomingWebhookType'
                            defaultMessage='(Incoming Webhook)'
                        />
                    </span>
                </div>
                <div className='details-row'>
                    <span className='description'>
                        {Utils.getWindowLocationOrigin() + '/hooks/' + incomingWebhook.id}
                    </span>
                </div>
            </div>
        </div>
    );
}

IncomingWebhook.propTypes = {
    incomingWebhook: React.PropTypes.object.isRequired
};

function OutgoingWebhook({outgoingWebhook}) {
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
                    </span>
                </div>
            </div>
        </div>
    );
}

OutgoingWebhook.propTypes = {
    outgoingWebhook: React.PropTypes.object.isRequired
};
