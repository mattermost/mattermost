// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {Role} from '@mattermost/types/roles';

import {t} from 'utils/i18n';
import {getHistory} from 'utils/browser_history';

import AdminPanel from 'components/widgets/admin_console/admin_panel';
import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import './system_roles.scss';

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
                        role: <FormattedMessage id={`admin.permissions.roles.${role.name}.name`}/>,
                        description: <FormattedMessage id={`admin.permissions.roles.${role.name}.description`}/>,
                        type: <FormattedMessage id={`admin.permissions.roles.${role.name}.type`}/>,
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
                            titleId={t('admin.permissions.systemRolesBannerTitle')}
                            titleDefault='Admin Roles'
                            subtitleId={t('admin.permissions.systemRolesBannerText')}
                            subtitleDefault='Manage different levels of access to the system console.'
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

t('admin.permissions.roles.system_admin.name');
t('admin.permissions.roles.system_admin.description');
t('admin.permissions.roles.system_admin.type');
t('admin.permissions.roles.system_user_manager.name');
t('admin.permissions.roles.system_user_manager.description');
t('admin.permissions.roles.system_user_manager.type');
t('admin.permissions.roles.system_manager.name');
t('admin.permissions.roles.system_manager.description');
t('admin.permissions.roles.system_manager.type');
t('admin.permissions.roles.system_read_only_admin.name');
t('admin.permissions.roles.system_read_only_admin.description');
t('admin.permissions.roles.system_read_only_admin.type');
t('admin.permissions.roles.system_custom_group_admin.name');
t('admin.permissions.roles.system_custom_group_admin.description');
t('admin.permissions.roles.system_custom_group_admin.type');

