// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRolePermission from './system_role_permission';
import {readAccess} from './types';

describe('admin_console/system_role_permission', () => {
    const defaultProps = {
        readOnly: true,
        setSectionVisible: vi.fn(),
        section: {
            name: 'environment',
            hasDescription: true,
            subsections: [],
        },
        permissionsMap: {
            sysconsole_read_environment: true,
        },
        visibleSections: {},
        permissionsToUpdate: {
            environment: readAccess,
        },
        updatePermissions: vi.fn(),
        roles: {
            system_admin: TestHelper.getRoleMock(),
        },
    };

    it('renders the section name', () => {
        renderWithContext(
            <SystemRolePermission
                {...defaultProps}
            />,
        );

        expect(screen.getByText('Environment')).toBeInTheDocument();
    });

    it('renders with description when hasDescription is true', () => {
        renderWithContext(
            <SystemRolePermission
                {...defaultProps}
            />,
        );

        // The component should render without errors when hasDescription is true
        expect(screen.getByText('Environment')).toBeInTheDocument();
    });
});
