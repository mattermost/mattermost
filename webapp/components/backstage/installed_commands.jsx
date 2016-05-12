// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import InstalledCommand from './installed_command.jsx';
import InstalledIntegrations from './installed_integrations.jsx';

export default class InstalledCommands extends React.Component {
    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);

        this.regenCommandToken = this.regenCommandToken.bind(this);
        this.deleteCommand = this.deleteCommand.bind(this);

        const teamId = TeamStore.getCurrentId();

        this.state = {
            commands: IntegrationStore.getCommands(teamId),
            loading: !IntegrationStore.hasReceivedCommands(teamId)
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

        if (window.mm_config.EnableCommands === 'true') {
            AsyncClient.listTeamCommands();
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            commands: IntegrationStore.getCommands(teamId),
            loading: !IntegrationStore.hasReceivedCommands(teamId)
        });
    }

    regenCommandToken(command) {
        AsyncClient.regenCommandToken(command.id);
    }

    deleteCommand(command) {
        AsyncClient.deleteCommand(command.id);
    }

    render() {
        const commands = this.state.commands.map((command) => {
            return (
                <InstalledCommand
                    key={command.id}
                    command={command}
                    onRegenToken={this.regenCommandToken}
                    onDelete={this.deleteCommand}
                />
            );
        });

        return (
            <InstalledIntegrations
                header={
                    <FormattedMessage
                        id='installed_commands.header'
                        defaultMessage='Installed Slash Commands'
                    />
                }
                addText={
                    <FormattedMessage
                        id='installed_commands.add'
                        defaultMessage='Add Slash Command'
                    />
                }
                addLink={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/commands/add'}
                emptyText={
                    <FormattedMessage
                        id='installed_commands.empty'
                        defaultMessage='No slash commands found'
                    />
                }
                loading={this.state.loading}
            >
                {commands}
            </InstalledIntegrations>
        );
    }
}
