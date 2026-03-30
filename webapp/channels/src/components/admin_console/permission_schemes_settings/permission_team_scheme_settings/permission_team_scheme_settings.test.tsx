// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Permissions from 'mattermost-redux/constants/permissions';

import {renderWithContext, screen, act, userEvent, waitFor} from 'tests/react_testing_utils';

import PermissionTeamSchemeSettings from './permission_team_scheme_settings';

// Store the latest props passed to each mocked tree component keyed by identifier
const mockPermissionsTreeProps: Record<string, any> = {};
const mockGuestTreeProps: Record<string, any> = {};
const mockPlaybookTreeProps: Record<string, any> = {};

// Identify PermissionsTree instances by scope + parentRole presence
function mockGetPermissionsTreeId(props: any): string {
    if (!props.parentRole && props.scope === 'team_scope') {
        return 'all_users';
    }
    if (props.scope === 'channel_scope') {
        return 'channel_admin';
    }
    if (props.parentRole && props.scope === 'team_scope') {
        return 'team_admin';
    }
    return 'unknown';
}

jest.mock('../permissions_tree', () => ({
    __esModule: true,
    default: (props: any) => {
        const id = mockGetPermissionsTreeId(props);
        mockPermissionsTreeProps[id] = props;
        return <div data-testid={`permissions-tree-${id}`}/>;
    },
    EXCLUDED_PERMISSIONS: [],
}));

jest.mock('../guest_permissions_tree', () => ({
    __esModule: true,
    default: (props: any) => {
        mockGuestTreeProps.guests = props;
        return <div data-testid='guest-permissions-tree-guests'/>;
    },
    GUEST_INCLUDED_PERMISSIONS: [],
}));

jest.mock('../permissions_tree_playbooks', () => ({
    __esModule: true,
    default: (props: any) => {
        mockPlaybookTreeProps.playbook_admin = props;
        return <div data-testid='playbook-permissions-tree-playbook_admin'/>;
    },
}));

describe('components/admin_console/permission_schemes_settings/permission_team_scheme_settings/permission_team_scheme_settings', () => {
    const defaultProps = {
        config: {
            EnableGuestAccounts: 'true',
        },
        license: {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'true',
            GuestAccountsPermissions: 'true',
        },
        location: {search: ''},
        schemeId: '',
        scheme: null,
        isDisabled: false,
        roles: {
            system_user: {
                permissions: [],
            },
            team_user: {
                permissions: [],
            },
            channel_user: {
                permissions: [],
            },
            system_admin: {
                permissions: [],
            },
            team_admin: {
                permissions: [],
            },
            channel_admin: {
                permissions: [],
            },
            team_guest: {
                permissions: [],
            },
            channel_guest: {
                permissions: [],
            },
            playbook_admin: {
                permissions: [],
            },
            playbook_member: {
                permissions: [],
            },
            run_admin: {
                permissions: [],
            },
            run_member: {
                permissions: [],
            },
            aaa: {
                permissions: [],
            },
            bbb: {
                permissions: [],
            },
            ccc: {
                permissions: [],
            },
            ddd: {
                permissions: [],
            },
            eee: {
                permissions: [],
            },
            fff: {
                permissions: [],
            },
            ggg: {
                permissions: [],
            },
            hhh: {
                permissions: [],
            },
            iii: {
                permissions: [],
            },
            jjj: {
                permissions: [],
            },
        },
        teams: [
        ],
        intl: {
            formatMessage: jest.fn(),
        },
        actions: {
            loadRolesIfNeeded: jest.fn().mockReturnValue(Promise.resolve()),
            loadRole: jest.fn(),
            loadScheme: jest.fn().mockReturnValue(Promise.resolve({data: true})),
            loadSchemeTeams: jest.fn(),
            editRole: jest.fn(),
            patchScheme: jest.fn(),
            createScheme: jest.fn(),
            updateTeamScheme: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
        history: {
            push: jest.fn(),
        },
    } as any;

    beforeEach(() => {
        // Clear captured props between tests
        Object.keys(mockPermissionsTreeProps).forEach((key) => delete mockPermissionsTreeProps[key]);
        Object.keys(mockGuestTreeProps).forEach((key) => delete mockGuestTreeProps[key]);
        Object.keys(mockPlaybookTreeProps).forEach((key) => delete mockPlaybookTreeProps[key]);
    });

    test('should match snapshot on new with default roles without permissions', async () => {
        renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );
        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        // Verify the tree components receive correct role data with empty permissions
        expect(mockPermissionsTreeProps.all_users).toBeDefined();
        expect(mockPermissionsTreeProps.all_users.role.permissions).toEqual([]);
        expect(mockPermissionsTreeProps.channel_admin).toBeDefined();
        expect(mockPermissionsTreeProps.channel_admin.role.permissions).toEqual([]);
        expect(mockPermissionsTreeProps.team_admin).toBeDefined();
        expect(mockPermissionsTreeProps.team_admin.role.permissions).toEqual([]);
    });

    test('should match snapshot on new with default roles with permissions', async () => {
        const roles = {
            system_guest: {
                permissions: ['create_post'],
            },
            team_guest: {
                permissions: ['invite_user'],
            },
            channel_guest: {
                permissions: ['add_reaction'],
            },
            system_user: {
                permissions: ['create_post'],
            },
            team_user: {
                permissions: ['invite_user'],
            },
            channel_user: {
                permissions: ['add_reaction'],
            },
            system_admin: {
                permissions: ['manage_system'],
            },
            team_admin: {
                permissions: ['add_user_to_team'],
            },
            channel_admin: {
                permissions: ['delete_post'],
            },
            playbook_admin: {
                permissions: [],
            },
            playbook_member: {
                permissions: [],
            },
            run_member: {
                permissions: [],
            },
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

        // Verify role data passed to trees includes permissions
        expect(mockPermissionsTreeProps.all_users.role.permissions).toEqual(
            expect.arrayContaining(['invite_user', 'add_reaction']),
        );
        expect(mockPermissionsTreeProps.channel_admin.role.permissions).toEqual(['delete_post']);
        expect(mockPermissionsTreeProps.team_admin.role.permissions).toEqual(['add_user_to_team']);
    });

    test('should save each role on handleSubmit except system_admin role', async () => {
        const editRole = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
        const createScheme = jest.fn().mockImplementation(() => Promise.resolve({
            data: {
                id: '123',
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
        }));
        const updateTeamScheme = jest.fn().mockImplementation(() => Promise.resolve({}));
        renderWithContext(
            <PermissionTeamSchemeSettings
                {...defaultProps}
                actions={{...defaultProps.actions, editRole, createScheme, updateTeamScheme}}
            />,
        );

        // Type in the name field to enable save
        const nameInput = screen.getByRole('textbox', {name: /scheme name/i});
        await userEvent.type(nameInput, 'Test Scheme');

        // Click save
        const saveButton = screen.getByTestId('saveSetting');
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(editRole).toHaveBeenCalledTimes(9);
        });
    });

    test('should show error if createScheme fails', async () => {
        const editRole = jest.fn().mockImplementation(() => Promise.resolve({}));
        const createScheme = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error'}}));
        const updateTeamScheme = jest.fn().mockImplementation(() => Promise.resolve({}));
        renderWithContext(
            <PermissionTeamSchemeSettings
                {...defaultProps}
                actions={{...defaultProps.actions, editRole, createScheme, updateTeamScheme}}
            />,
        );

        // Type in the name field to enable save
        const nameInput = screen.getByRole('textbox', {name: /scheme name/i});
        await userEvent.type(nameInput, 'Test Scheme');

        // Click save
        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => {
            expect(screen.getByText('test error')).toBeInTheDocument();
        });
    });

    test('should show error if editRole fails', async () => {
        const editRole = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error'}}));
        const createScheme = jest.fn().mockImplementation(() => Promise.resolve({
            data: {
                id: '123',
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
        }));
        const updateTeamScheme = jest.fn().mockImplementation(() => Promise.resolve({}));
        renderWithContext(
            <PermissionTeamSchemeSettings
                {...defaultProps}
                actions={{...defaultProps.actions, editRole, createScheme, updateTeamScheme}}
            />,
        );

        // Type in the name field to enable save
        const nameInput = screen.getByRole('textbox', {name: /scheme name/i});
        await userEvent.type(nameInput, 'Test Scheme');

        // Click save
        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => {
            expect(screen.getByText('test error')).toBeInTheDocument();
        });
    });

    test('should open and close correctly roles blocks', async () => {
        renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );

        // All sections should be open initially (no 'closed' class)
        const guestsPanel = screen.getByTestId('guest-permissions-tree-guests').closest('.AdminPanelTogglable');
        const allUsersPanel = screen.getByTestId('permissions-tree-all_users').closest('.AdminPanelTogglable');
        const channelAdminPanel = screen.getByTestId('permissions-tree-channel_admin').closest('.AdminPanelTogglable');
        const teamAdminPanel = screen.getByTestId('permissions-tree-team_admin').closest('.AdminPanelTogglable');

        expect(guestsPanel).not.toHaveClass('closed');
        expect(allUsersPanel).not.toHaveClass('closed');
        expect(channelAdminPanel).not.toHaveClass('closed');
        expect(teamAdminPanel).not.toHaveClass('closed');

        // Toggle guests closed
        await userEvent.click(screen.getByText('Guests'));
        expect(guestsPanel).toHaveClass('closed');

        // Toggle guests open
        await userEvent.click(screen.getByText('Guests'));
        expect(guestsPanel).not.toHaveClass('closed');

        // Toggle all_users closed
        await userEvent.click(screen.getByText('All Members'));
        expect(allUsersPanel).toHaveClass('closed');

        // Toggle all_users open
        await userEvent.click(screen.getByText('All Members'));
        expect(allUsersPanel).not.toHaveClass('closed');

        // Toggle channel_admin closed
        await userEvent.click(screen.getByText('Channel Administrators'));
        expect(channelAdminPanel).toHaveClass('closed');

        // Toggle channel_admin open
        await userEvent.click(screen.getByText('Channel Administrators'));
        expect(channelAdminPanel).not.toHaveClass('closed');

        // Toggle team_admin closed
        await userEvent.click(screen.getByText('Team Administrators'));
        expect(teamAdminPanel).toHaveClass('closed');

        // Toggle team_admin open
        await userEvent.click(screen.getByText('Team Administrators'));
        expect(teamAdminPanel).not.toHaveClass('closed');
    });

    test('should match snapshot on edit without permissions', async () => {
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

        renderWithContext(
            <PermissionTeamSchemeSettings {...props}/>,
        );
        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        // Verify the component renders with the scheme data
        expect(screen.getByDisplayValue('Test scheme')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test scheme description')).toBeInTheDocument();

        // Verify role trees are rendered with empty permissions
        expect(mockPermissionsTreeProps.all_users).toBeDefined();
        expect(mockPermissionsTreeProps.all_users.role.permissions).toEqual([]);
    });

    test('should match snapshot on edit with permissions', async () => {
        const props = {
            ...defaultProps,
            config: {
                EnableGuestAccounts: 'false',
            },
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
            roles: {
                aaa: {
                    permissions: ['invite_user'],
                },
                bbb: {
                    name: 'team_admin',
                    permissions: ['add_user_to_team'],
                },
                ccc: {
                    permissions: ['add_reaction'],
                },
                ddd: {
                    name: 'channel_admin',
                    permissions: ['delete_post'],
                },
                eee: {
                    permissions: ['edit_post'],
                },
                fff: {
                    permissions: ['delete_post'],
                },
                ggg: {
                    permissions: ['delete_post'],
                },
                hhh: {
                    permissions: ['delete_post'],
                },
                iii: {
                    permissions: ['delete_post'],
                },
                jjj: {
                    permissions: ['delete_post'],
                },
            },
        };

        renderWithContext(
            <PermissionTeamSchemeSettings {...props}/>,
        );
        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        // Verify role data is passed to trees
        expect(mockPermissionsTreeProps.all_users.role.permissions).toEqual(
            expect.arrayContaining(['invite_user', 'add_reaction']),
        );
        expect(mockPermissionsTreeProps.channel_admin.role.permissions).toEqual(['delete_post']);
        expect(mockPermissionsTreeProps.team_admin.role.permissions).toEqual(['add_user_to_team']);

        // Toggle a moderated permission on channel_admin
        act(() => {
            mockPermissionsTreeProps.channel_admin.onToggle('channel_admin', [Permissions.CREATE_POST]);
        });

        expect(mockPermissionsTreeProps.channel_admin.role.permissions).toContain(Permissions.CREATE_POST);

        // Toggle again to disable
        act(() => {
            mockPermissionsTreeProps.channel_admin.onToggle('channel_admin', [Permissions.CREATE_POST]);
        });

        expect(mockPermissionsTreeProps.channel_admin.role.permissions).not.toContain(Permissions.CREATE_POST);

        // Toggle team_admin
        act(() => {
            mockPermissionsTreeProps.team_admin.onToggle('team_admin', [Permissions.CREATE_POST]);
        });

        expect(mockPermissionsTreeProps.team_admin.role.permissions).toContain(Permissions.CREATE_POST);

        // Toggle again to disable
        act(() => {
            mockPermissionsTreeProps.team_admin.onToggle('team_admin', [Permissions.CREATE_POST]);
        });

        expect(mockPermissionsTreeProps.team_admin.role.permissions).not.toContain(Permissions.CREATE_POST);
    });

    test('should match snapshot on edit without guest permissions', async () => {
        const props = {
            ...defaultProps,
            config: {
                EnableGuestAccounts: 'false',
            },
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

        renderWithContext(
            <PermissionTeamSchemeSettings {...props}/>,
        );
        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        // Guests section should NOT be rendered when EnableGuestAccounts is 'false'
        expect(screen.queryByTestId('guest-permissions-tree-guests')).not.toBeInTheDocument();

        // Other sections should still be present
        expect(screen.getByTestId('permissions-tree-all_users')).toBeInTheDocument();
        expect(screen.getByTestId('permissions-tree-channel_admin')).toBeInTheDocument();
        expect(screen.getByTestId('permissions-tree-team_admin')).toBeInTheDocument();
    });

    test('should match snapshot on edit without license', async () => {
        const props = {
            ...defaultProps,
            license: {
                IsLicensed: 'false',
            },
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

        renderWithContext(
            <PermissionTeamSchemeSettings {...props}/>,
        );
        await waitFor(() => {
            expect(defaultProps.actions.loadRolesIfNeeded).toHaveBeenCalled();
        });

        // Verify the form still renders
        expect(screen.getByDisplayValue('Test scheme')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test scheme description')).toBeInTheDocument();

        // All Members, Channel Admin, and Team Admin sections still render
        expect(screen.getByTestId('permissions-tree-all_users')).toBeInTheDocument();
        expect(screen.getByTestId('permissions-tree-channel_admin')).toBeInTheDocument();
        expect(screen.getByTestId('permissions-tree-team_admin')).toBeInTheDocument();
    });

    test('should set moderated permissions on team/channel admins', () => {
        renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );

        // A moderated permission should set team/channel admins
        act(() => {
            mockPermissionsTreeProps.all_users.onToggle('all_users', [Permissions.CREATE_POST]);
        });

        expect(mockPermissionsTreeProps.all_users.role.permissions).toContain(Permissions.CREATE_POST);
        expect(mockPermissionsTreeProps.channel_admin.role.permissions).toContain(Permissions.CREATE_POST);
        expect(mockPermissionsTreeProps.team_admin.role.permissions).toContain(Permissions.CREATE_POST);
        expect(mockPlaybookTreeProps.playbook_admin.role.permissions).not.toContain(Permissions.CREATE_POST);

        // Changing a non-moderated permission should NOT set team/channel admins
        act(() => {
            mockPermissionsTreeProps.all_users.onToggle('all_users', [Permissions.EDIT_OTHERS_POSTS]);
        });

        expect(mockPermissionsTreeProps.all_users.role.permissions).toContain(Permissions.EDIT_OTHERS_POSTS);
        expect(mockPermissionsTreeProps.channel_admin.role.permissions).not.toContain(Permissions.EDIT_OTHERS_POSTS);
        expect(mockPermissionsTreeProps.team_admin.role.permissions).not.toContain(Permissions.EDIT_OTHERS_POSTS);
        expect(mockPlaybookTreeProps.playbook_admin.role.permissions).not.toContain(Permissions.EDIT_OTHERS_POSTS);
    });
});
