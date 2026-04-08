// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRolePermissions from './system_role_permissions';
import {readAccess, writeAccess} from './types';

describe('admin_console/system_role_permissions', () => {
    const props = {
        isLicensedForCloud: false,
        updatePermissions: jest.fn(),
        permissionsToUpdate: {
            environment: readAccess,
            plugins: writeAccess,
            site: writeAccess,
        },
        role: TestHelper.getRoleMock(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SystemRolePermissions
                {...props}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with isLicensedForCloud = true', () => {
        const {container} = renderWithContext(
            <SystemRolePermissions
                {...props}
                isLicensedForCloud={true}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('ensure that when you change a prop and component is re-rendered, SystemRolePermission is not being deleted due to isLicensedForCloud being false (test for bug MM-31403)', () => {
        const {rerender} = renderWithContext(
            <SystemRolePermissions
                {...props}
            />,
        );

        // Count the permission sections rendered
        const getSectionCount = () => screen.getAllByTestId(/^permission_section_/).length;

        const expectedLength = getSectionCount();

        // Re-render with updated permissions
        rerender(
            <SystemRolePermissions
                {...props}
                permissionsToUpdate={{
                    environment: writeAccess,
                    plugins: readAccess,
                }}
            />,
        );

        expect(getSectionCount()).toEqual(expectedLength);
    });
});
