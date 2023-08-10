// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import CopyText from 'components/copy_text';

import DeleteIntegrationLink from './delete_integration_link';

import type {Command} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

type Props = {

    /**
     * The team data
     */
    team: Team;

    /**
     * Installed slash command to display
     */
    command: Command;

    /**
     * The function to call when Regenerate Token link is clicked
     */
    onRegenToken: (command: Command) => void ;

    /**
     * The function to call when Delete link is clicked
     */
    onDelete: (command: Command) => void ;

    /**
     * Set to filter command, comes from BackstageList
     */
    filter?: string;

    /**
     * The creator user data
     */
    creator: UserProfile;

    /**
     * Set to show edit link
     */
    canChange: boolean;
}

export function matchesFilter(command: Command, filter?: string) {
    if (!filter) {
        return true;
    }

    return command.display_name.toLowerCase().indexOf(filter) !== -1 ||
        command.description.toLowerCase().indexOf(filter) !== -1 ||
        command.trigger.toLowerCase().indexOf(filter) !== -1;
}

export default class InstalledCommand extends React.PureComponent<Props> {
    handleRegenToken = (e: React.MouseEvent) => {
        e.preventDefault();

        this.props.onRegenToken(this.props.command);
    };

    handleDelete = () => {
        this.props.onDelete(this.props.command);
    };

    render() {
        const command = this.props.command;
        const filter = this.props.filter ? this.props.filter.toLowerCase() : '';

        if (!matchesFilter(command, filter)) {
            return null;
        }

        let name;

        if (command.display_name) {
            name = command.display_name;
        } else {
            name = (
                <FormattedMessage
                    id='installed_commands.unnamed_command'
                    defaultMessage='Unnamed Slash Command'
                />
            );
        }

        let description = null;
        if (command.description) {
            description = (
                <div className='item-details__row'>
                    <span className='item-details__description'>
                        {command.description}
                    </span>
                </div>
            );
        }

        let trigger = '- /' + command.trigger;
        if (command.auto_complete && command.auto_complete_hint) {
            trigger += ' ' + command.auto_complete_hint;
        }

        let actions = null;
        if (this.props.canChange) {
            actions = (
                <div className='item-actions'>
                    <button
                        className='style--none color--link'
                        onClick={this.handleRegenToken}
                    >
                        <FormattedMessage
                            id='installed_integrations.regenToken'
                            defaultMessage='Regenerate Token'
                        />
                    </button>
                    {' - '}
                    <Link to={`/${this.props.team.name}/integrations/commands/edit?id=${command.id}`}>
                        <FormattedMessage
                            id='installed_integrations.edit'
                            defaultMessage='Edit'
                        />
                    </Link>
                    {' - '}
                    <DeleteIntegrationLink
                        modalMessage={
                            <FormattedMessage
                                id='installed_commands.delete.confirm'
                                defaultMessage='This action permanently deletes the slash command and breaks any integrations using it. Are you sure you want to delete it?'
                            />
                        }
                        onDelete={this.handleDelete}
                    />
                </div>
            );
        }

        const commandToken = command.token;

        return (
            <div className='backstage-list__item'>
                <div className='item-details'>
                    <div className='item-details__row d-flex flex-column flex-md-row justify-content-between'>
                        <div>
                            <strong className='item-details__name'>
                                {name}
                            </strong>
                            <span className='item-details__trigger'>
                                {trigger}
                            </span>
                        </div>
                        {actions}
                    </div>
                    {description}
                    <div className='item-details__row'>
                        <span className='item-details__token'>
                            <FormattedMessage
                                id='installed_integrations.token'
                                defaultMessage='Token: {token}'
                                values={{
                                    token: commandToken,
                                }}
                            />
                            <CopyText
                                value={commandToken}
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__creation'>
                            <FormattedMessage
                                id='installed_integrations.creation'
                                defaultMessage='Created by {creator} on {createAt, date, full}'
                                values={{
                                    creator: this.props.creator.username,
                                    createAt: command.create_at,
                                }}
                            />
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}
