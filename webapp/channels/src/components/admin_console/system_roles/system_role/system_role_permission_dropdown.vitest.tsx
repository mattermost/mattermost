// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import SystemRolePermissionDropdown from './system_role_permission_dropdown';
import {readAccess, writeAccess, noAccess} from './types';

describe('admin_console/system_role_permission_dropdown', () => {
    const baseProps = {
        section: {
            name: 'environment',
            hasDescription: true,
            subsections: [],
        },
        access: readAccess,
        updatePermissions: vi.fn(),
        isDisabled: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders with read access', () => {
        renderWithContext(
            <SystemRolePermissionDropdown
                {...baseProps}
            />,
        );

        expect(screen.getByText('Read only')).toBeInTheDocument();
    });

    it('renders with write access', () => {
        renderWithContext(
            <SystemRolePermissionDropdown
                {...baseProps}
                access={writeAccess}
            />,
        );

        expect(screen.getByText('Can edit')).toBeInTheDocument();
    });

    it('renders with no access', () => {
        renderWithContext(
            <SystemRolePermissionDropdown
                {...baseProps}
                access={noAccess}
            />,
        );

        expect(screen.getByText('No access')).toBeInTheDocument();
    });

    it('renders with isDisabled true', () => {
        renderWithContext(
            <SystemRolePermissionDropdown
                {...baseProps}
                isDisabled={true}
            />,
        );

        expect(screen.getByText('Read only')).toBeInTheDocument();
    });

    it('renders dropdown button with correct id', () => {
        renderWithContext(
            <SystemRolePermissionDropdown
                {...baseProps}
            />,
        );

        const button = document.getElementById('systemRolePermissionDropdownenvironment');
        expect(button).toBeInTheDocument();
    });
});
