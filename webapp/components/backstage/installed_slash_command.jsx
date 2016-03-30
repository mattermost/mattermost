// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class InstalledSlashCommand extends React.Component {
    static get propTypes() {
        return {
            slashCommand: React.PropTypes.object.isRequired,
            onDelete: React.PropTypes.func.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
    }

    handleDelete(e) {
        e.preventDefault();

        this.props.onDelete(this.props.slashCommand);
    }

    render() {
        const slashCommand = this.props.slashCommand;

        return (
            <div className='installed-integrations__item installed-integrations__slash-command'>
                <div className='details'>
                    <div className='details-row'>
                        <span className='name'>
                            {slashCommand.display_name}
                        </span>
                        <span className='type'>
                            <FormattedMessage
                                id='installed_integrations.slashCommandType'
                                defaultMessage='(Slash Command)'
                            />
                        </span>
                    </div>
                    <div className='details-row'>
                        <span className='description'>
                            {slashCommand.description}
                        </span>
                    </div>
                    <div className='details-row'>
                        <span className='creation'>
                            <FormattedMessage
                                id='installed_integrations.creation'
                                defaultMessage='Created by {creator} on {createAt, date, full}'
                                values={{
                                    creator: Utils.displayUsername(slashCommand.creator_Id),
                                    createAt: slashCommand.create_at
                                }}
                            />
                        </span>
                    </div>
                </div>
                <div className='actions'>
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
