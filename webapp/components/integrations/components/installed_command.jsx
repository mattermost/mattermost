import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {Link} from 'react-router';
import {FormattedMessage} from 'react-intl';

import DeleteIntegration from './delete_integration.jsx';

export default class InstalledCommand extends React.Component {
    static get propTypes() {
        return {
            team: PropTypes.object.isRequired,
            command: PropTypes.object.isRequired,
            onRegenToken: PropTypes.func.isRequired,
            onDelete: PropTypes.func.isRequired,
            filter: PropTypes.string,
            creator: PropTypes.object.isRequired,
            canChange: PropTypes.bool.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleRegenToken = this.handleRegenToken.bind(this);
        this.handleDelete = this.handleDelete.bind(this);

        this.matchesFilter = this.matchesFilter.bind(this);
    }

    handleRegenToken(e) {
        e.preventDefault();

        this.props.onRegenToken(this.props.command);
    }

    handleDelete() {
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
