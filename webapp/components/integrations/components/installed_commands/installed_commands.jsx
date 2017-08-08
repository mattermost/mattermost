// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import InstalledCommand from '../installed_command.jsx';

import * as Utils from 'utils/utils.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class InstalledCommands extends React.PureComponent {
    static propTypes = {

        /**
        * The team object
        */
        team: PropTypes.object,

        /**
        * The user object
        */
        user: PropTypes.object,

        /**
        * The users collection
        */
        users: PropTypes.object,

        /**
        * Installed slash commands to display
        */
        commands: PropTypes.array,

        /**
        * Set whether to show the loading... animation or not
        */
        loading: PropTypes.bool,

        /**
        * Set to allow changes to installed slash commands
        */
        isAdmin: PropTypes.bool,

        actions: PropTypes.shape({

            /**
            * The function to call when Regenerate Token link is clicked
            */
            regenCommandToken: PropTypes.func.isRequired,

            /**
            * The function to call when Delete link is clicked
            */
            deleteCommand: PropTypes.func.isRequired
        }).isRequired
    }

    regenCommandToken = (command) => {
        this.props.actions.regenCommandToken(command.id);
    }

    deleteCommand = (command) => {
        this.props.actions.deleteCommand(command.id);
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
                        defaultMessage='Use slash commands to connect external tools to Mattermost. {buildYourOwn} or visit the {appDirectory} to find self-hosted, third-party apps and integrations.'
                        values={{
                            buildYourOwn: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='http://docs.mattermost.com/developer/slash-commands.html'
                                >
                                    <FormattedMessage
                                        id='installed_commands.help.buildYourOwn'
                                        defaultMessage='Build your own'
                                    />
                                </a>
                            ),
                            appDirectory: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='https://about.mattermost.com/default-app-directory/'
                                >
                                    <FormattedMessage
                                        id='installed_commands.help.appDirectory'
                                        defaultMessage='App Directory'
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