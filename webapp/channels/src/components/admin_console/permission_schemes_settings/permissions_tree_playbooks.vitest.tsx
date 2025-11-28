// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PermissionsTreePlaybooks from './permissions_tree_playbooks';

// Mock console.error to suppress intl missing message warnings in tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = (...args: any[]) => {
        const message = args[0]?.toString() || '';
        if (message.includes('MISSING_TRANSLATION') || message.includes('Missing message:')) {
            return;
        }
        originalConsoleError.apply(console, args);
    };
});

afterAll(() => {
    console.error = originalConsoleError;
});

describe('components/admin_console/permission_schemes_settings/permissions_tree_playbooks', () => {
    const defaultProps = {
        role: TestHelper.getRoleMock({
            name: 'playbook_admin',
            permissions: [],
        }),
        scope: 'playbook_scope',
        onToggle: vi.fn(),
        parentRole: undefined,
        readOnly: false,
        selectRow: vi.fn(),
        license: {
            IsLicensed: 'true',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the playbooks permissions tree', () => {
        renderWithContext(<PermissionsTreePlaybooks {...defaultProps}/>);

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders in read only mode', () => {
        renderWithContext(
            <PermissionsTreePlaybooks
                {...defaultProps}
                readOnly={true}
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with role permissions', () => {
        const role = TestHelper.getRoleMock({
            name: 'playbook_admin',
            permissions: ['playbook_public_create', 'playbook_private_create'],
        });

        renderWithContext(
            <PermissionsTreePlaybooks
                {...defaultProps}
                role={role}
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with parent role', () => {
        const parentRole = TestHelper.getRoleMock({
            name: 'system_admin',
            permissions: ['playbook_public_create'],
        });

        renderWithContext(
            <PermissionsTreePlaybooks
                {...defaultProps}
                parentRole={parentRole}
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });
});
