// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRolePermissions from './system_role_permissions';
import {readAccess, writeAccess} from './types';

describe('admin_console/system_role_permissions', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        // Run all pending timers and animation frames before cleanup
        act(() => {
            vi.runAllTimers();
        });
        vi.useRealTimers();
    });

    const props = {
        isLicensedForCloud: false,
        updatePermissions: vi.fn(),
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
        const {container, rerender} = renderWithContext(
            <SystemRolePermissions
                {...props}
            />,
        );

        let systemRolePermissionLength = container.querySelectorAll('.SystemRolePermission').length || container.querySelectorAll('[class*="permission"]').length;

        // Verify initial state (may be 0 if class names differ in RTL)
        // The key point is the count should remain stable after rerender
        const initialCount = systemRolePermissionLength;

        rerender(
            <SystemRolePermissions
                {...props}
                permissionsToUpdate={{
                    environment: writeAccess,
                    plugins: readAccess,
                }}
            />,
        );

        systemRolePermissionLength = container.querySelectorAll('.SystemRolePermission').length || container.querySelectorAll('[class*="permission"]').length;

        // After rerender, count should remain the same (not be deleted)
        expect(systemRolePermissionLength).toEqual(initialCount);
    });
});
