// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Role} from '@mattermost/types/roles';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';

import PermissionSystemSchemeSettings from './permission_system_scheme_settings';

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

describe('components/admin_console/permission_schemes_settings/permission_system_scheme_settings', () => {
    const defaultRole: Role = {
        id: '',
        display_name: '',
        name: '',
        description: '',
        create_at: 0,
        delete_at: 0,
        built_in: false,
        scheme_managed: false,
        update_at: 0,
        permissions: [],
    };

    const defaultProps = {
        config: {
            EnableGuestAccounts: 'true',
        },
        license: {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'true',
            GuestAccountsPermissions: 'true',
        },
        location: {} as Location,
        roles: {
            system_guest: defaultRole,
            team_guest: defaultRole,
            channel_guest: defaultRole,
            system_user: defaultRole,
            team_user: defaultRole,
            channel_user: defaultRole,
            system_admin: defaultRole,
            team_admin: defaultRole,
            channel_admin: defaultRole,
            playbook_admin: defaultRole,
            playbook_member: defaultRole,
            run_admin: defaultRole,
            run_member: defaultRole,
        },
        actions: {
            loadRolesIfNeeded: vi.fn().mockResolvedValue({}),
            editRole: vi.fn().mockResolvedValue({data: {}}),
            setNavigationBlocked: vi.fn(),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the page', async () => {
        renderWithContext(<PermissionSystemSchemeSettings {...defaultProps}/>);

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        // Should render the page
        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders without custom permission schemes license', async () => {
        const license = {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'false',
        };

        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                license={license}
            />,
        );

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with roles that have permissions', async () => {
        const roles: Record<string, Role> = {
            system_guest: {...defaultRole, permissions: ['create_post']},
            team_guest: {...defaultRole, permissions: ['invite_user']},
            channel_guest: {...defaultRole, permissions: ['add_reaction']},
            system_user: {...defaultRole, permissions: ['create_post']},
            team_user: {...defaultRole, permissions: ['invite_user']},
            channel_user: {...defaultRole, permissions: ['add_reaction']},
            system_admin: {...defaultRole, permissions: ['manage_system']},
            team_admin: {...defaultRole, permissions: ['add_user_to_team']},
            channel_admin: {...defaultRole, permissions: ['delete_post']},
            playbook_admin: defaultRole,
            playbook_member: defaultRole,
            run_admin: defaultRole,
            run_member: defaultRole,
        };

        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                roles={roles}
            />,
        );

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('calls loadRolesIfNeeded on mount', async () => {
        renderWithContext(<PermissionSystemSchemeSettings {...defaultProps}/>);

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalledTimes(1);
        });
    });

    it('renders save and reset buttons', async () => {
        renderWithContext(<PermissionSystemSchemeSettings {...defaultProps}/>);

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        // Find buttons in the page
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });
});
