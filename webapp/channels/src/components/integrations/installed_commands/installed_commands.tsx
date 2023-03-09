// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ActionResult} from 'mattermost-redux/types/actions';
import * as Utils from 'utils/utils';
import BackstageList from 'components/backstage/components/backstage_list';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {RelationOneToOne} from '@mattermost/types/utilities';
import {Command} from '@mattermost/types/integrations';
import InstalledCommand, {matchesFilter} from '../installed_command';
import ExternalLink from 'components/external_link';

type Props = {
    team: Team;
    user: UserProfile;
    users: RelationOneToOne<UserProfile, UserProfile>;

    // Installed slash commands to display
    commands: Command[];
    loading: boolean;

    // Set to allow changes to installed slash commands
    canManageOthersSlashCommands: boolean;
    actions: {

        // The function to call when Regenerate Token link is clicked
        regenCommandToken: (id: string) => Promise<ActionResult>;

        // The function to call when Delete link is clicked
        deleteCommand: (id: string) => Promise<ActionResult>;
    };
}

export default class InstalledCommands extends React.PureComponent<Props> {
    public regenCommandToken = (command: Command): void => {
        this.props.actions.regenCommandToken(command.id);
    }

    public deleteCommand = (command: Command): void => {
        this.props.actions.deleteCommand(command.id);
    }

    private commandCompare(a: Command, b: Command) {
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

    public render(): JSX.Element {
        const commands = (filter: string) => this.props.commands.
            filter((command) => command.team_id === this.props.team.id).
            filter((command) => matchesFilter(command, filter)).
            sort(this.commandCompare).map((command) => {
                const canChange = this.props.canManageOthersSlashCommands || this.props.user.id === command.creator_id;

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
                addButtonId='addSlashCommand'
                emptyText={
                    <FormattedMessage
                        id='installed_commands.empty'
                        defaultMessage='No slash commands found'
                    />
                }
                emptyTextSearch={
                    <FormattedMarkdownMessage
                        id='installed_commands.emptySearch'
                        defaultMessage='No slash commands match {searchTerm}'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_commands.help'
                        defaultMessage='Use slash commands to connect external tools to Mattermost. {buildYourOwn} or visit the {appDirectory} to find self-hosted, third-party apps and integrations.'
                        values={{
                            buildYourOwn: (
                                <ExternalLink
                                    href='https://developers.mattermost.com/integrate/admin-guide/admin-slash-commands/'
                                    location='installed_commands'
                                >
                                    <FormattedMessage
                                        id='installed_commands.help.buildYourOwn'
                                        defaultMessage='Build Your Own'
                                    />
                                </ExternalLink>
                            ),
                            appDirectory: (
                                <ExternalLink
                                    href='https://mattermost.com/marketplace'
                                    location='installed_commands'
                                >
                                    <FormattedMessage
                                        id='installed_commands.help.appDirectory'
                                        defaultMessage='App Directory'
                                    />
                                </ExternalLink>
                            ),
                        }}
                    />
                }
                searchPlaceholder={Utils.localizeMessage('installed_commands.search', 'Search Slash Commands')}
                loading={this.props.loading}
            >
                {(filter: string) => {
                    const children = commands(filter);
                    return [children, children.length > 0];
                }}
            </BackstageList>
        );
    }
}
