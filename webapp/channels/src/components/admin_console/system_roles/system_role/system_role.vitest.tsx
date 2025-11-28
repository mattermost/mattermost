// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemRole from './system_role';

describe('admin_console/system_role', () => {
    const role = TestHelper.getRoleMock({
        id: 'role_id',
        name: 'system_manager',
        display_name: 'System Manager',
        permissions: [
            'sysconsole_read_environment',
            'sysconsole_write_plugins',
        ],
    });

    const baseProps = {
        role,
        isDisabled: false,
        isLicensedForCloud: false,
        actions: {
            editRole: vi.fn().mockResolvedValue({data: true}),
            updateUserRoles: vi.fn().mockResolvedValue({data: true}),
            setNavigationBlocked: vi.fn(),
        },
    };

    const initialState = {
        entities: {
            roles: {
                roles: {
                    system_manager: role,
                },
            },
            users: {
                profiles: {},
                filteredStats: {
                    total_users_count: 0,
                },
            },
        },
        views: {
            search: {
                userGridSearch: {
                    term: '',
                },
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders system role page', () => {
        renderWithContext(
            <SystemRole {...baseProps}/>,
            initialState,
        );

        // Should render the back link
        expect(document.querySelector('.fa-angle-left')).toBeInTheDocument();
    });

    it('renders with isLicensedForCloud true', () => {
        renderWithContext(
            <SystemRole
                {...baseProps}
                isLicensedForCloud={true}
            />,
            initialState,
        );

        expect(document.querySelector('.fa-angle-left')).toBeInTheDocument();
    });

    it('renders save changes panel', () => {
        renderWithContext(
            <SystemRole {...baseProps}/>,
            initialState,
        );

        // SaveChangesPanel renders a cancel link
        expect(screen.getByRole('link', {name: /cancel/i})).toBeInTheDocument();
    });
});
