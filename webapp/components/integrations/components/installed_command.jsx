// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router';
import {FormattedMessage} from 'react-intl';

import DeleteIntegration from './delete_integration.jsx';

export default class InstalledCommand extends React.PureComponent {
    static propTypes = {

        /**
        * The team data
        */
        team: PropTypes.object.isRequired,

        /**
        * Installed slash command to display
        */
        command: PropTypes.object.isRequired,

        /**
        * The function to call when Regenerate Token link is clicked
        */
        onRegenToken: PropTypes.func.isRequired,

        /**
        * The function to call when Delete link is clicked
        */
        onDelete: PropTypes.func.isRequired,

        /**
        * Set to filter command, comes from BackstageList
        */
        filter: PropTypes.string,

        /**
        * The creator user data
        */
        creator: PropTypes.object.isRequired,

        /**
        * Set to show edit link
        */
        canChange: PropTypes.bool.isRequired
    }

    handleRegenToken = (e) => {
        e.preventDefault();

        this.props.onRegenToken(this.props.command);
    }

    handleDelete = () => {
        this.props.onDelete(this.props.command);
    }

    matchesFilter(command, filter) {
        if (!filter) {
            return true;
        }

        return command.display_name.toLowerCase().indexOf(filter) !== -1 ||
            command.description.toLowerCase().indexOf(filter) !== -1 ||
            command.trigger.toLowerCase().indexOf(filter) !== -1;
    }

    render() {
        const command = this.props.command;
        const filter = this.props.filter ? this.props.filter.toLowerCase() : '';

        if (!this.matchesFilter(command, filter)) {
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
                    <a
                        href='#'
                        onClick={this.handleRegenToken}
                    >
                        <FormattedMessage
                            id='installed_integrations.regenToken'
                            defaultMessage='Regenerate Token'
                        />
                    </a>
                    {' - '}
                    <Link to={`/${this.props.team.name}/integrations/commands/edit?id=${command.id}`}>
                        <FormattedMessage
                            id='installed_integrations.edit'
                            defaultMessage='Edit'
                        />
                    </Link>
                    {' - '}
                    <DeleteIntegration
                        messageId='installed_commands.delete.confirm'
                        onDelete={this.handleDelete}
                    />
                </div>
            );
        }

        return (
            <div className='backstage-list__item'>
                <div className='item-details'>
                    <div className='item-details__row'>
                        <span className='item-details__name'>
                            {name}
                        </span>
                        <span className='item-details__trigger'>
                            {trigger}
                        </span>
                    </div>
                    {description}
                    <div className='item-details__row'>
                        <span className='item-details__token'>
                            <FormattedMessage
                                id='installed_integrations.token'
                                defaultMessage='Token: {token}'
                                values={{
                                    token: command.token
                                }}
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
                                    createAt: command.create_at
                                }}
                            />
                        </span>
                    </div>
                </div>
                {actions}
            </div>
        );
    }
}
