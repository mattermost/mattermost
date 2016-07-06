// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as Utils from 'utils/utils.jsx';

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import {FormattedMessage} from 'react-intl';
import InstalledCommand from './installed_command.jsx';

export default class InstalledCommands extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

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
            <BackstageList
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
                addLink={'/' + this.props.team.name + '/integrations/commands/add'}
                emptyText={
                    <FormattedMessage
                        id='installed_commands.empty'
                        defaultMessage='No slash commands found'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_commands.help'
                        defaultMessage='Create slash commands for use in external integrations. Please see {link} to learn more.'
                        values={{
                            link: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='http://docs.mattermost.com/developer/slash-commands.html'
                                >
                                    <FormattedMessage
                                        id='installed_commands.helpLink'
                                        defaultMessage='documentation'
                                    />
                                </a>
                            )
                        }}
                    />
                }
                searchPlaceholder={Utils.localizeMessage('installed_commands.search', 'Search Slash Commands')}
                loading={this.state.loading}
            >
                {commands}
            </BackstageList>
        );
    }
}
