// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import MigrationsTable from 'components/admin_console/database';

const SchemaMigrations = () => {
    return (
        <div className='form-group'>
            <label
                className='control-label col-sm-4'
            >
                <FormattedMessage
                    id='admin.database.migrations_table.title'
                    defaultMessage='Schema Migrations:'
                />
            </label>
            <div className='col-sm-8'>
                <div className='migrations-table-setting'>
                    <MigrationsTable
                        createHelpText={
                            <FormattedMessage
                                id='admin.database.migrations_table.help_text'
                                defaultMessage='All applied migrations.'
                            />
                        }
                    />
                </div>
            </div>
        </div>
    );
};

export default SchemaMigrations;
