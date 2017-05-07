// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import InstalledCommand from './installed_command.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class InstalledCommands extends React.Component {
    static get propTypes() {
        return {
            team: React.PropTypes.object,
            user: React.PropTypes.object,
            users: React.PropTypes.object,
            commands: React.PropTypes.array,
            loading: React.PropTypes.bool,
            isAdmin: React.PropTypes.bool
        };
    }

    constructor(props) {
        super(props);

        this.regenCommandToken = this.regenCommandToken.bind(this);
        this.deleteCommand = this.deleteCommand.bind(this);
    }

    regenCommandToken(command) {
        AsyncClient.regenCommandToken(command.id);
    }

    deleteCommand(command) {
        AsyncClient.deleteCommand(command.id);
    }

    commandCompare(a, b) {
        let nameA = a.display_name;
        if (!nameA) {
            nameA = Utils.localizeMessage('installed_commands.unnamed_command', 'Unnamed Slash Command');
        }

        let nameB = b.display_name;
        if (!nameB) {
            nameB = Utils.localizeMessage('installed_commands.unnamed_command', 'Unnamed Slash Command');
        }

        return nameA.localeCompare(nameB);
    }

    render() {
        const commands = this.props.commands.sort(this.commandCompare).map((command) => {
            const canChange = this.props.isAdmin || this.props.user.id === command.creator_id;

            return (
                <InstalledCommand
                    key={command.id}
                    team={this.props.team}
                    command={command}
                    onRegenToken={this.regenCommandToken}
                    onDelete={this.deleteCommand}
                    creator={this.props.users[command.creator_id] || {}}
                    canChange={canChange}
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
                loading={this.props.loading}
            >
                {commands}
            </BackstageList>
        );
    }
}
