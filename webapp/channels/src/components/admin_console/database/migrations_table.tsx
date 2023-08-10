// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {SchemaMigration} from '@mattermost/types/admin';
import type {ActionResult} from 'mattermost-redux/types/actions';

import './migrations_table.scss';

export type Props = {
    createHelpText: React.ReactElement;
    className?: string;
    actions: {
        getAppliedSchemaMigrations: () => Promise<ActionResult>;
    };
}

type State = {
    migrations: SchemaMigration[];
}

class MigrationsTable extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            migrations: [],
        };
    }

    componentDidMount() {
        this.props.actions.getAppliedSchemaMigrations().then((result) => {
            this.setState({
                migrations: result.data,
            });
        });
    }

    render() {
        const items = this.state.migrations.map((migration) => {
            return (
                <tr
                    key={migration.version}
                >
                    <td className='whitespace--nowrap'>{migration.version}</td>
                    <td className='whitespace--nowrap'>{migration.name}</td>
                </tr>
            );
        });

        return (
            <div className={classNames('MigrationsTable', 'migrations-table__panel', this.props.className)}>
                <div className='help-text'>
                    {this.props.createHelpText}
                </div>
                <div className='migrations-table__table'>
                    <table
                        className='table'
                        data-testid='migrationsTable'
                    >
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='admin.database.migrations_table.version'
                                        defaultMessage='Version'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.database.migrations_table.name'
                                        defaultMessage='Name'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

export default MigrationsTable;
