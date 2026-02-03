// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {SchemaMigration} from '@mattermost/types/admin';

import type {ActionResult} from 'mattermost-redux/types/actions';

import './migrations_table.scss';

type Props = {
    createHelpText: React.ReactElement;
    className?: string;
    actions: {
        getAppliedSchemaMigrations: () => Promise<ActionResult>;
    };
}

const MigrationsTable = ({
    createHelpText,
    className,
    actions,
}: Props) => {
    const [migrations, setMigrations] = useState<SchemaMigration[]>([]);

    useEffect(() => {
        async function handleGetAppliedSchemaMigrations() {
            const result: ActionResult = await actions.getAppliedSchemaMigrations();
            if (result.data) {
                setMigrations(result.data);
            }
        }

        handleGetAppliedSchemaMigrations();
    }, []);

    const items = useMemo(() => migrations.map((migration) => {
        return (
            <tr
                key={migration.version}
            >
                <td className='whitespace--nowrap'>{migration.version}</td>
                <td className='whitespace--nowrap'>{migration.name}</td>
            </tr>
        );
    }), [migrations]);

    return (
        <div className={classNames('MigrationsTable', 'migrations-table__panel', className)}>
            <div className='help-text'>
                {createHelpText}
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
};

export default React.memo(MigrationsTable);
