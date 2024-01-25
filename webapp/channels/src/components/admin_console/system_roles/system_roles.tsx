// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {Role} from '@mattermost/types/roles';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import type {Row, Column} from 'components/admin_console/data_grid/data_grid';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {getHistory} from 'utils/browser_history';

import './system_roles.scss';
import {rolesStrings} from './strings';

type Props = {
    roles: Record<string, Role>;
}

const columns: Column[] = [
    {
        name: 'Role',
        field: 'role',
        width: 2,
    },
    {
        name: 'Description',
        field: 'description',
        width: 3,
    },
    {
        name: 'Type',
        field: 'type',
        width: 2,
    },
    {
        name: '',
        field: 'edit',
        width: 1,
        textAlign: 'right',
    },
];

export default class SystemRoles extends React.PureComponent<Props> {
    render() {
        const {roles} = this.props;
        const roleNames = ['system_admin', 'system_manager', 'system_user_manager', 'system_custom_group_admin', 'system_read_only_admin'];
        const rows: Row[] = [];
        roleNames.forEach((name) => {
            const role = roles[name];
            if (role) {
                rows.push({
                    cells: {
                        role: <FormattedMessage {...rolesStrings[role.name].name}/>,
                        description: <FormattedMessage {...rolesStrings[role.name].description}/>,
                        type: <FormattedMessage {...rolesStrings[role.name].type}/>,
                        edit: (
                            <span
                                className='SystemRoles_editRow'
                                data-testid={`${role.name}_edit`}
                            >
                                <Link to={`/admin_console/user_management/system_roles/${role.id}`} >
                                    <FormattedMessage
                                        id='admin.permissions.roles.edit'
                                        defaultMessage='Edit'
                                    />
                                </Link>
                            </span>
                        ),
                    },
                    onClick: () => getHistory().push(`/admin_console/user_management/system_roles/${role.id}`),
                });
            }
        });

        return (
            <div className='wrapper--fixed'>
                <AdminHeader>
                    <FormattedMessage
                        id='admin.permissions.systemRoles'
                        defaultMessage='System Roles'
                    />
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <AdminPanel
                            id='SystemRoles'
                            title={defineMessage({id: 'admin.permissions.systemRolesBannerTitle', defaultMessage: 'Admin Roles'})}
                            subtitle={defineMessage({id: 'admin.permissions.systemRolesBannerText', defaultMessage: 'Manage different levels of access to the system console.'})}
                        >
                            <div className='SystemRoles'>
                                <DataGrid
                                    rows={rows}
                                    columns={columns}
                                    page={1}
                                    startCount={0}
                                    endCount={rows.length}
                                    loading={false}
                                    nextPage={() => {}}
                                    previousPage={() => {}}
                                />
                            </div>
                        </AdminPanel>
                    </div>
                </div>
            </div>
        );
    }
}
