// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import InstalledCommand from './installed_command.jsx';

import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {loadTeamCommands} from 'actions/integration_actions.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class InstalledCommands extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);
        this.handleUserChange = this.handleUserChange.bind(this);
        this.regenCommandToken = this.regenCommandToken.bind(this);
        this.deleteCommand = this.deleteCommand.bind(this);

        const teamId = TeamStore.getCurrentId();

        this.state = {
            commands: IntegrationStore.getCommands(teamId),
            loading: !IntegrationStore.hasReceivedCommands(teamId),
            users: UserStore.getProfiles()
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);
        UserStore.addChangeListener(this.handleUserChange);

        if (window.mm_config.EnableCommands === 'true') {
            loadTeamCommands();
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
        UserStore.removeChangeListener(this.handleUserChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            commands: IntegrationStore.getCommands(teamId),
            loading: !IntegrationStore.hasReceivedCommands(teamId)
        });
    }

    handleUserChange() {
        this.setState({users: UserStore.getProfiles()});
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
                    creator={this.state.users[command.creator_id] || {}}
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
