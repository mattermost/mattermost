// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PermissionsTree from './permissions_tree';

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

describe('components/admin_console/permission_schemes_settings/permissions_tree', () => {
    const defaultProps = {
        scope: 'channel_scope',
        role: TestHelper.getRoleMock({
            name: 'test',
            permissions: [],
        }),
        onToggle: vi.fn(),
        selectRow: vi.fn(),
        parentRole: undefined,
        readOnly: false,
        license: {
            LDAPGroups: 'true',
            IsLicensed: 'true',
        },
        config: {
            EnableIncomingWebhooks: 'true',
            EnableOutgoingWebhooks: 'true',
            EnableOutgoingOAuthConnections: 'true',
            EnableOAuthServiceProvider: 'true',
            EnableCommands: 'true',
        },
        customGroupsEnabled: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the permissions tree', () => {
        renderWithContext(<PermissionsTree {...defaultProps}/>);

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders in read only mode', () => {
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                readOnly={true}
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with team scope', () => {
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                scope="team_scope"
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with system scope', () => {
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                scope="system_scope"
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with parent role with permissions', () => {
        const parentRole = TestHelper.getRoleMock({permissions: ['invite_user']});
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                parentRole={parentRole}
                scope="system_scope"
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders without LDAPGroups in license', () => {
        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                license={{}}
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with role permissions', () => {
        const role = TestHelper.getRoleMock({
            name: 'test',
            permissions: ['create_post', 'add_reaction'],
        });

        renderWithContext(
            <PermissionsTree
                {...defaultProps}
                role={role}
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });
});
