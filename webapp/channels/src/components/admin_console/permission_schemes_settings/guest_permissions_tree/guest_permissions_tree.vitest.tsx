// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GuestPermissionsTree from './guest_permissions_tree';

describe('components/admin_console/permission_schemes_settings/guest_permissions_tree', () => {
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
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the permissions tree', () => {
        renderWithContext(<GuestPermissionsTree {...defaultProps}/>);

        // Should render permission groups
        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders in read only mode', () => {
        renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                readOnly={true}
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with team scope', () => {
        renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                scope="team_scope"
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with system scope', () => {
        renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                scope="system_scope"
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders with parent role with permissions', () => {
        const parentRole = TestHelper.getRoleMock({permissions: ['invite_user']});
        renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                parentRole={parentRole}
                scope="system_scope"
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });

    it('renders without LDAPGroups in license', () => {
        renderWithContext(
            <GuestPermissionsTree
                {...defaultProps}
                license={{}}
            />,
        );

        expect(document.querySelector('.permissions-tree')).toBeInTheDocument();
    });
});
