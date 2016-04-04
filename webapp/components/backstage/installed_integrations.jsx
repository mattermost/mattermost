// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import InstalledIncomingWebhook from './installed_incoming_webhook.jsx';
import InstalledOutgoingWebhook from './installed_outgoing_webhook.jsx';
import {Link} from 'react-router';

export default class InstalledIntegrations extends React.Component {
    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);
        this.updateFilter = this.updateFilter.bind(this);
        this.updateTypeFilter = this.updateTypeFilter.bind(this);

        this.deleteIncomingWebhook = this.deleteIncomingWebhook.bind(this);
        this.regenOutgoingWebhookToken = this.regenOutgoingWebhookToken.bind(this);
        this.deleteOutgoingWebhook = this.deleteOutgoingWebhook.bind(this);

        this.state = {
            incomingWebhooks: [],
            outgoingWebhooks: [],
            typeFilter: '',
            filter: ''
        };
    }

    componentWillMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

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
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        this.setState({
            incomingWebhooks: IntegrationStore.getIncomingWebhooks(),
            outgoingWebhooks: IntegrationStore.getOutgoingWebhooks()
        });
    }

    updateTypeFilter(e, typeFilter) {
        e.preventDefault();

        this.setState({
            typeFilter
        });
    }

    updateFilter(e) {
        this.setState({
            filter: e.target.value
        });
    }

    deleteIncomingWebhook(incomingWebhook) {
        AsyncClient.deleteIncomingHook(incomingWebhook.id);
    }

    regenOutgoingWebhookToken(outgoingWebhook) {
        AsyncClient.regenOutgoingHookToken(outgoingWebhook.id);
    }

    deleteOutgoingWebhook(outgoingWebhook) {
        AsyncClient.deleteOutgoingHook(outgoingWebhook.id);
    }

    renderTypeFilters(incomingWebhooks, outgoingWebhooks) {
        const fields = [];

        if (incomingWebhooks.length > 0 || outgoingWebhooks.length > 0) {
            let filterClassName = 'filter-sort';
            if (this.state.typeFilter === '') {
                filterClassName += ' filter-sort--active';
            }

            fields.push(
                <a
                    key='allFilter'
                    className={filterClassName}
                    href='#'
                    onClick={(e) => this.updateTypeFilter(e, '')}
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

            let filterClassName = 'filter-sort';
            if (this.state.typeFilter === 'incomingWebhooks') {
                filterClassName += ' filter-sort--active';
            }

            fields.push(
                <a
                    key='incomingWebhooksFilter'
                    className={filterClassName}
                    href='#'
                    onClick={(e) => this.updateTypeFilter(e, 'incomingWebhooks')}
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

            let filterClassName = 'filter-sort';
            if (this.state.typeFilter === 'outgoingWebhooks') {
                filterClassName += ' filter-sort--active';
            }

            fields.push(
                <a
                    key='outgoingWebhooksFilter'
                    className={filterClassName}
                    href='#'
                    onClick={(e) => this.updateTypeFilter(e, 'outgoingWebhooks')}
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
            <div className='backstage-filters__sort'>
                {fields}
            </div>
        );
    }

    render() {
        const incomingWebhooks = this.state.incomingWebhooks;
        const outgoingWebhooks = this.state.outgoingWebhooks;

        const filter = this.state.filter.toLowerCase();

        const integrations = [];
        if (!this.state.typeFilter || this.state.typeFilter === 'incomingWebhooks') {
            for (const incomingWebhook of incomingWebhooks) {
                if (filter) {
                    const channel = ChannelStore.get(incomingWebhook.channel_id);

                    if (!channel || channel.name.toLowerCase().indexOf(filter) === -1) {
                        continue;
                    }
                }

                integrations.push(
                    <InstalledIncomingWebhook
                        key={incomingWebhook.id}
                        incomingWebhook={incomingWebhook}
                        onDeleteClick={this.deleteIncomingWebhook}
                    />
                );
            }
        }

        if (!this.state.typeFilter || this.state.typeFilter === 'outgoingWebhooks') {
            for (const outgoingWebhook of outgoingWebhooks) {
                if (filter) {
                    const channel = ChannelStore.get(outgoingWebhook.channel_id);

                    if (!channel || channel.name.toLowerCase().indexOf(filter) === -1) {
                        continue;
                    }
                }

                integrations.push(
                    <InstalledOutgoingWebhook
                        key={outgoingWebhook.id}
                        outgoingWebhook={outgoingWebhook}
                        onRegenToken={this.regenOutgoingWebhookToken}
                        onDelete={this.deleteOutgoingWebhook}
                    />
                );
            }
        }

        return (
            <div className='backstage-content row'>
                <div className='installed-integrations'>
                    <div className='backstage-header'>
                        <h1>
                            <FormattedMessage
                                id='installed_integrations.header'
                                defaultMessage='Installed Integrations'
                            />
                        </h1>
                        <Link
                            className='add-integrations-link'
                            to={'/settings/integrations/add'}
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
                    <div className='backstage-filters'>
                        {this.renderTypeFilters(this.state.incomingWebhooks, this.state.outgoingWebhooks)}
                        <div className='backstage-filter__search'>
                            <i className='fa fa-search'></i>
                            <input
                                type='search'
                                className='form-control'
                                placeholder={Utils.localizeMessage('installed_integrations.search', 'Search Integrations')}
                                value={this.state.filter}
                                onChange={this.updateFilter}
                                style={{flexGrow: 0, flexShrink: 0}}
                            />
                        </div>
                    </div>
                    <div className='backstage-list'>
                        {integrations}
                    </div>
                </div>
            </div>
        );
    }
}
