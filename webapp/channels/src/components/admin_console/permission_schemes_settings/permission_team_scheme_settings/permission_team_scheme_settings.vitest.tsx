// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';

import PermissionTeamSchemeSettings from './permission_team_scheme_settings';

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

describe('components/admin_console/permission_schemes_settings/permission_team_scheme_settings', () => {
    const defaultProps = {
        config: {
            EnableGuestAccounts: 'true',
        },
        license: {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'true',
            GuestAccountsPermissions: 'true',
        },
        location: {},
        schemeId: '',
        scheme: null,
        isDisabled: false,
        roles: {
            system_user: {permissions: []},
            team_user: {permissions: []},
            channel_user: {permissions: []},
            system_admin: {permissions: []},
            team_admin: {permissions: []},
            channel_admin: {permissions: []},
            team_guest: {permissions: []},
            channel_guest: {permissions: []},
            playbook_admin: {permissions: []},
            playbook_member: {permissions: []},
            run_admin: {permissions: []},
            run_member: {permissions: []},
            aaa: {permissions: []},
            bbb: {permissions: []},
            ccc: {permissions: []},
            ddd: {permissions: []},
            eee: {permissions: []},
            fff: {permissions: []},
            ggg: {permissions: []},
            hhh: {permissions: []},
            iii: {permissions: []},
            jjj: {permissions: []},
        },
        teams: [],
        intl: {
            formatMessage: vi.fn((msg) => msg.defaultMessage || msg.id),
        },
        actions: {
            loadRolesIfNeeded: vi.fn().mockResolvedValue({}),
            loadRole: vi.fn(),
            loadScheme: vi.fn().mockResolvedValue({data: true}),
            loadSchemeTeams: vi.fn(),
            editRole: vi.fn().mockResolvedValue({data: {}}),
            patchScheme: vi.fn(),
            createScheme: vi.fn().mockResolvedValue({data: {id: '123'}}),
            updateTeamScheme: vi.fn().mockResolvedValue({}),
            setNavigationBlocked: vi.fn(),
        },
        history: {
            push: vi.fn(),
        },
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the page for new scheme', async () => {
        renderWithContext(<PermissionTeamSchemeSettings {...defaultProps}/>);

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with existing scheme', async () => {
        const props = {
            ...defaultProps,
            schemeId: 'xyz',
            scheme: {
                id: 'xxx',
                name: 'yyy',
                display_name: 'Test scheme',
                description: 'Test scheme description',
                default_team_user_role: 'aaa',
                default_team_admin_role: 'bbb',
                default_channel_user_role: 'ccc',
                default_channel_admin_role: 'ddd',
                default_team_guest_role: 'eee',
                default_channel_guest_role: 'fff',
                default_playbook_admin_role: 'ggg',
                default_playbook_member_role: 'hhh',
                default_run_admin_role: 'iii',
                default_run_member_role: 'jjj',
            },
        };

        renderWithContext(<PermissionTeamSchemeSettings {...props}/>);

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with roles that have permissions', async () => {
        const roles = {
            ...defaultProps.roles,
            system_user: {permissions: ['create_post']},
            team_user: {permissions: ['invite_user']},
            channel_user: {permissions: ['add_reaction']},
            team_admin: {name: 'team_admin', permissions: ['add_user_to_team']},
            channel_admin: {name: 'channel_admin', permissions: ['delete_post']},
        };

        renderWithContext(
            <PermissionTeamSchemeSettings
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
        renderWithContext(<PermissionTeamSchemeSettings {...defaultProps}/>);

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalledTimes(1);
        });
    });

    it('renders without license', async () => {
        const props = {
            ...defaultProps,
            license: {
                IsLicensed: 'false',
            },
        };

        renderWithContext(<PermissionTeamSchemeSettings {...props}/>);

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders without guest accounts', async () => {
        const props = {
            ...defaultProps,
            config: {
                EnableGuestAccounts: 'false',
            },
        };

        renderWithContext(<PermissionTeamSchemeSettings {...props}/>);

        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });
});
