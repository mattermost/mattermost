// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientLicense} from '@mattermost/types/config';
import {Role} from '@mattermost/types/roles';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import Permissions from 'mattermost-redux/constants/permissions';

import {isEnterpriseLicense, isNonEnterpriseLicense} from 'utils/license_utils';

import PermissionGroup from './permission_group';

interface Props {
    role?: Partial<Role>;
    parentRole: any;
    scope: string;
    selectRow: any;
    readOnly: boolean;
    onToggle: (a: string, b: string[]) => void;
    license: ClientLicense;
}

const groups = [
    {
        id: 'playbook_public',
        permissions: [
            Permissions.PLAYBOOK_PUBLIC_MANAGE_PROPERTIES,
            Permissions.PLAYBOOK_PUBLIC_MANAGE_MEMBERS,
        ],
        isVisible: isNonEnterpriseLicense,
    },
    {
        id: 'playbook_public',
        permissions: [
            Permissions.PLAYBOOK_PUBLIC_MANAGE_PROPERTIES,
            Permissions.PLAYBOOK_PUBLIC_MANAGE_MEMBERS,
            Permissions.PLAYBOOK_PUBLIC_MAKE_PRIVATE,
        ],
        isVisible: isEnterpriseLicense,
    },
    {
        id: 'playbook_private',
        permissions: [
            Permissions.PLAYBOOK_PRIVATE_MANAGE_PROPERTIES,
            Permissions.PLAYBOOK_PRIVATE_MANAGE_MEMBERS,
            Permissions.PLAYBOOK_PRIVATE_MAKE_PUBLIC,
        ],
        isVisible: isEnterpriseLicense,
    },
    {
        id: 'runs',
        permissions: [
            Permissions.RUN_CREATE,
        ],
    },
];

const PermissionsTreePlaybooks = (props: Props) => {
    const toggleGroup = (ids: string[]) => {
        if (props.readOnly) {
            return;
        }
        props.onToggle(props.role?.name || '', ids);
    };

    const filteredGroups = groups.filter((group) => {
        if (group.isVisible) {
            return group.isVisible(props.license);
        }

        return true;
    });

    return (
        <div className='permissions-tree'>
            <div className='permissions-tree--header'>
                <div className='permission-name'>
                    <FormattedMessage
                        id='admin.permissions.permissionsTree.permission'
                        defaultMessage='Permission'
                    />
                </div>
                <div className='permission-description'>
                    <FormattedMessage
                        id='admin.permissions.permissionsTree.description'
                        defaultMessage='Description'
                    />
                </div>
            </div>
            <div className='permissions-tree--body'>
                <PermissionGroup
                    key='all'
                    id='all'
                    parentRole={props.parentRole}
                    uniqId={props.role?.name}
                    selectRow={props.selectRow}
                    readOnly={props.readOnly}
                    permissions={filteredGroups}
                    role={props.role}
                    scope={props.scope}
                    combined={false}
                    onChange={toggleGroup}
                    root={true}
                />
            </div>
        </div>
    );
};

export default PermissionsTreePlaybooks;
