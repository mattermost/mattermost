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
            onDelete: React.PropTypes.func.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleRegenToken = this.handleRegenToken.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
    }

    handleRegenToken(e) {
        e.preventDefault();

        this.props.onRegenToken(this.props.command);
    }

    handleDelete(e) {
        e.preventDefault();

        this.props.onDelete(this.props.command);
    }

    render() {
        const command = this.props.command;

        return (
            <div className='backstage-list__item'>
                <div className='item-details'>
                    <div className='item-details__row'>
                        <span className='item-details__name'>
                            {command.display_name}
                        </span>
                        <span className='item-details__type'>
                            <FormattedMessage
                                id='installed_integrations.commandType'
                                defaultMessage='(Slash Command)'
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__description'>
                            {command.description}
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__creation'>
                            <FormattedMessage
                                id='installed_integrations.creation'
                                defaultMessage='Created by {creator} on {createAt, date, full}'
                                values={{
                                    creator: Utils.displayUsername(command.creator_Id),
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
                            defaultMessage='Regen Token'
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
