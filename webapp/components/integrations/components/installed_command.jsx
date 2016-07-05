// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class InstalledCommand extends React.Component {
    static get propTypes() {
        return {
            command: React.PropTypes.object.isRequired,
            onRegenToken: React.PropTypes.func.isRequired,
            onDelete: React.PropTypes.func.isRequired,
            filter: React.PropTypes.string
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

    handleDelete(e) {
        e.preventDefault();

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
                                    creator: Utils.displayUsername(command.creator_id),
                                    createAt: command.create_at
                                }}
                            />
                        </span>
                    </div>
                </div>
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
                    <a
                        href='#'
                        onClick={this.handleDelete}
                    >
                        <FormattedMessage
                            id='installed_integrations.delete'
                            defaultMessage='Delete'
                        />
                    </a>
                </div>
            </div>
        );
    }
}
