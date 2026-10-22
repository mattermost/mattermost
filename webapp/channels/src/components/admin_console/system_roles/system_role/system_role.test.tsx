// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRole from './system_role';

jest.mock('./system_role_permissions', () => {
    return function MockSystemRolePermissions(props: {role: {name: string}}) {
        return <div data-testid='mock-system-role-permissions'>{`Permissions for ${props.role.name}`}</div>;
    };
});

jest.mock('./system_role_users', () => {
    return {
        __esModule: true,
        default: function MockSystemRoleUsers(props: {roleName: string}) {
            return <div data-testid='mock-system-role-users'>{`Users for ${props.roleName}`}</div>;
        },
    };
});

describe('admin_console/system_role', () => {
    const props = {
        role: TestHelper.getRoleMock(),
        isDisabled: false,
        isLicensedForCloud: false,
        actions: {
            editRole: jest.fn(),
            updateUserRoles: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SystemRole
                {...props}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with isLicensedForCloud = true', () => {
        const {container} = renderWithContext(
            <SystemRole
                {...props}
                isLicensedForCloud={true}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
