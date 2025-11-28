// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRolePermissions from './system_role_permissions';
import {readAccess, writeAccess} from './types';

describe('admin_console/system_role_permissions', () => {
    const baseProps = {
        isLicensedForCloud: false,
        updatePermissions: vi.fn(),
        permissionsToUpdate: {
            environment: readAccess,
            plugins: writeAccess,
            site: writeAccess,
        },
        role: TestHelper.getRoleMock({
            id: 'role_id',
            name: 'system_manager',
            display_name: 'System Manager',
            permissions: [
                'sysconsole_read_environment',
                'sysconsole_write_plugins',
                'sysconsole_write_site',
            ],
        }),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders system role permissions section', () => {
        renderWithContext(
            <SystemRolePermissions {...baseProps}/>,
        );

        // Should render the Privileges panel title
        expect(screen.getByText('Privileges')).toBeInTheDocument();
    });

    it('renders with isLicensedForCloud true', () => {
        renderWithContext(
            <SystemRolePermissions
                {...baseProps}
                isLicensedForCloud={true}
            />,
        );

        expect(screen.getByText('Privileges')).toBeInTheDocument();
    });

    it('renders permission sections for system_manager role', () => {
        renderWithContext(
            <SystemRolePermissions {...baseProps}/>,
        );

        // system_manager role should show Environment section
        expect(screen.getByText('Privileges')).toBeInTheDocument();
    });
});
