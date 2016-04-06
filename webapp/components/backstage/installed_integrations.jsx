// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import InstalledIncomingWebhook from './installed_incoming_webhook.jsx';
import InstalledOutgoingWebhook from './installed_outgoing_webhook.jsx';
import InstalledCommand from './installed_command.jsx';
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
        this.regenCommandToken = this.regenCommandToken.bind(this);
        this.deleteCommand = this.deleteCommand.bind(this);

        this.state = {
            incomingWebhooks: [],
            outgoingWebhooks: [],
            commands: [],
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

        if (window.mm_config.EnableCommands === 'true') {
            if (IntegrationStore.hasReceivedCommands()) {
                this.setState({
                    commands: IntegrationStore.getCommands()
                });
            } else {
                AsyncClient.listTeamCommands();
            }
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        const incomingWebhooks = IntegrationStore.getIncomingWebhooks();
        const outgoingWebhooks = IntegrationStore.getOutgoingWebhooks();
        const commands = IntegrationStore.getCommands();

        this.setState({
            incomingWebhooks,
            outgoingWebhooks,
            commands
        });

        // reset the type filter if we were viewing a category that is now empty
        if ((this.state.typeFilter === 'incomingWebhooks' && incomingWebhooks.length === 0) ||
            (this.state.typeFilter === 'outgoingWebhooks' && outgoingWebhooks.length === 0) ||
            (this.state.typeFilter === 'commands' && commands.length === 0)) {
            this.setState({
                typeFilter: ''
            });
        }
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

    regenCommandToken(command) {
        AsyncClient.regenCommandToken(command.id);
    }

    deleteCommand(command) {
        AsyncClient.deleteCommand(command.id);
    }

    renderTypeFilters(incomingWebhooks, outgoingWebhooks, commands) {
        const fields = [];

        let allFilterClassName = 'filter-sort';
        if (this.state.typeFilter === '') {
            allFilterClassName += ' filter-sort--active';
        }

        fields.push(
            <a
                key='allFilter'
                className={allFilterClassName}
                href='#'
                onClick={(e) => this.updateTypeFilter(e, '')}
            >
                <FormattedMessage
                    id='installed_integrations.allFilter'
                    defaultMessage='All ({count, number})'
                    values={{
                        count: incomingWebhooks.length + outgoingWebhooks.length + commands.length
                    }}
                />
            </a>
        );

        fields.push(
            <span
                key='incomingWebhooksDivider'
                className='divider'
            >
                {'|'}
            </span>
        );

        let incomingWebhookClassName = 'filter-sort';
        if (this.state.typeFilter === 'incomingWebhooks') {
            incomingWebhookClassName += ' filter-sort--active';
        }

        fields.push(
            <a
                key='incomingWebhooksFilter'
                className={incomingWebhookClassName}
                href='#'
                onClick={(e) => this.updateTypeFilter(e, 'incomingWebhooks')}
            >
                <FormattedMessage
                    id='installed_integrations.incomingWebhooksFilter'
                    defaultMessage='Incoming Webhooks ({count, number})'
                    values={{
                        count: incomingWebhooks.length
                    }}
                />
            </a>
        );

        fields.push(
            <span
                key='outgoingWebhooksDivider'
                className='divider'
            >
                {'|'}
            </span>
        );

        let outgoingWebhookClassName = 'filter-sort';
        if (this.state.typeFilter === 'outgoingWebhooks') {
            outgoingWebhookClassName += ' filter-sort--active';
        }

        fields.push(
            <a
                key='outgoingWebhooksFilter'
                className={outgoingWebhookClassName}
                href='#'
                onClick={(e) => this.updateTypeFilter(e, 'outgoingWebhooks')}
            >
                <FormattedMessage
                    id='installed_integrations.outgoingWebhooksFilter'
                    defaultMessage='Outgoing Webhooks ({count, number})'
                    values={{
                        count: outgoingWebhooks.length
                    }}
                />
            </a>
        );

        fields.push(
            <span
                key='commandsDivider'
                className='divider'
            >
                {'|'}
            </span>
        );

        let commandClassName = 'filter-sort';
        if (this.state.typeFilter === 'commands') {
            commandClassName += ' filter-sort--active';
        }

        fields.push(
            <a
                key='commandsFilter'
                className={commandClassName}
                href='#'
                onClick={(e) => this.updateTypeFilter(e, 'commands')}
            >
                <FormattedMessage
                    id='installed_integrations.commandsFilter'
                    defaultMessage='Slash Commands ({count, number})'
                    values={{
                        count: commands.length
                    }}
                />
            </a>
        );

        return (
            <div className='backstage-filters__sort'>
                {fields}
            </div>
        );
    }

    render() {
        const filter = this.state.filter.toLowerCase();

        let incomingWebhooks = [];
        if (this.state.filter) {
            incomingWebhooks = this.state.incomingWebhooks.filter((incomingWebhook) => {
                return InstalledIncomingWebhook.matches(incomingWebhook, filter);
            });
        } else {
            incomingWebhooks = this.state.incomingWebhooks;
        }

        let outgoingWebhooks = [];
        if (this.state.filter) {
            outgoingWebhooks = this.state.outgoingWebhooks.filter((outgoingWebhook) => {
                return InstalledOutgoingWebhook.matches(outgoingWebhook, filter);
            });
        } else {
            outgoingWebhooks = this.state.outgoingWebhooks;
        }

        let commands = [];
        if (this.state.filter) {
            commands = this.state.commands.filter((command) => {
                return InstalledCommand.matches(command, filter);
            });
        } else {
            commands = this.state.commands;
        }

        const integrations = [];
        if (!this.state.typeFilter || this.state.typeFilter === 'incomingWebhooks') {
            for (const incomingWebhook of incomingWebhooks) {
                integrations.push(
                    <InstalledIncomingWebhook
                        key={incomingWebhook.id}
                        incomingWebhook={incomingWebhook}
                        onDelete={this.deleteIncomingWebhook}
                    />
                );
            }
        }

        if (!this.state.typeFilter || this.state.typeFilter === 'outgoingWebhooks') {
            for (const outgoingWebhook of outgoingWebhooks) {
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

        if (!this.state.typeFilter || this.state.typeFilter === 'commands') {
            for (const command of commands) {
                integrations.push(
                    <InstalledCommand
                        key={command.id}
                        command={command}
                        onRegenToken={this.regenCommandToken}
                        onDelete={this.deleteCommand}
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
                        {this.renderTypeFilters(incomingWebhooks, outgoingWebhooks, commands)}
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
