// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Command} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import CommandsList from './commands_list';

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
    };

    public deleteCommand = (command: Command): void => {
        this.props.actions.deleteCommand(command.id);
    };

    public render(): JSX.Element {
        // Filter commands for this team
        const teamCommands = this.props.commands.filter((command) => command.team_id === this.props.team.id);

        return (
            <CommandsList
                commands={teamCommands}
                users={this.props.users}
                team={this.props.team}
                canManageOthersSlashCommands={this.props.canManageOthersSlashCommands}
                currentUser={this.props.user}
                onDelete={this.deleteCommand}
                onRegenToken={this.regenCommandToken}
                loading={this.props.loading}
            />
        );
    }
}
