// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';

import type {Role} from '@mattermost/types/roles';

import Permissions from 'mattermost-redux/constants/permissions';

import {PermissionSystemSchemeSettings} from 'components/admin_console/permission_schemes_settings/permission_system_scheme_settings/permission_system_scheme_settings';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen} from 'tests/react_testing_utils';
import {DefaultRolePermissions} from 'utils/constants';

describe('components/admin_console/permission_schemes_settings/permission_system_scheme_settings/permission_system_scheme_settings', () => {
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
        intl: defaultIntl,
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
            loadRolesIfNeeded: jest.fn().mockReturnValue(Promise.resolve()),
            editRole: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    test('should match snapshot on roles without permissions', (done) => {
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                ref={ref}
            />,
        );
        defaultProps.actions.loadRolesIfNeeded().then(() => {
            expect(ref.current!.state).toMatchSnapshot();
            done();
        });
    });

    test('should match snapshot when the license doesnt have custom schemes', (done) => {
        const license = {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'false',
        };
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                license={license}
            />,
        );
        defaultProps.actions.loadRolesIfNeeded().then(() => {
            expect(container).toMatchSnapshot();
            done();
        });
    });

    test('should match snapshot on roles with permissions', (done) => {
        const roles: Record<string, Role> = {
            system_guest: {
                ...defaultRole,
                permissions: ['create_post'],
            },
            team_guest: {
                ...defaultRole,
                permissions: ['invite_user'],
            },
            channel_guest: {
                ...defaultRole,
                permissions: ['add_reaction'],
            },
            system_user: {
                ...defaultRole,
                permissions: ['create_post'],
            },
            team_user: {
                ...defaultRole,
                permissions: ['invite_user'],
            },
            channel_user: {
                ...defaultRole,
                permissions: ['add_reaction'],
            },
            system_admin: {
                ...defaultRole,
                permissions: ['manage_system'],
            },
            team_admin: {
                ...defaultRole,
                permissions: ['add_user_to_team'],
            },
            channel_admin: {
                ...defaultRole,
                permissions: ['delete_post'],
            },
        };
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                roles={roles}
                ref={ref}
            />,
        );

        expect(container).toMatchSnapshot();
        defaultProps.actions.loadRolesIfNeeded().then(() => {
            expect(ref.current!.state).toMatchSnapshot();
            done();
        });
    });

    test('should render the Playbook Administrators role heading as plural', () => {
        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
            />,
        );

        // Regression test for MM-60599: the Playbook role heading must be plural
        // ("Playbook Administrators") to stay consistent with the other role headings.
        expect(screen.getByRole('heading', {name: 'Playbook Administrators'})).toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: 'Playbook Administrator'})).not.toBeInTheDocument();

        for (const roleName of ['Channel Administrators', 'Team Administrators', 'System Administrators']) {
            expect(screen.getByRole('heading', {name: roleName})).toBeInTheDocument();
        }
    });

    test('should save each role on handleSubmit except system_admin role', async () => {
        const editRole = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                actions={{...defaultProps.actions, editRole}}
                ref={ref}
            />,
        );

        expect(container).toMatchSnapshot();

        await act(async () => {
            await (ref.current as any).handleSubmit();
        });
        expect(editRole).toHaveBeenCalledTimes(11);
    });

    test('should preserve the team-scoped space permissions across a save', async () => {
        // The save path rebuilds team_user/team_guest/channel_user by filtering the
        // aggregated all_users/guests role through PermissionsScope, so a space
        // permission missing (or misclassified) in that map would be silently
        // dropped from -- or leaked into -- a role the admin never touched.
        // team_admin is saved from state unfiltered (handleSubmit passes it straight
        // through to editRole), so it is deliberately excluded here: asserting on it
        // would pass even if PermissionsScope had no entry at all for these
        // permissions.
        const editRole = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                roles={{
                    ...defaultProps.roles,
                    team_user: {...defaultRole, name: 'team_user', permissions: [Permissions.READ_SPACE, Permissions.CREATE_SPACE, Permissions.MANAGE_SPACE, Permissions.DELETE_SPACE]},
                    team_guest: {...defaultRole, name: 'team_guest', permissions: [Permissions.READ_SPACE]},
                    channel_user: {...defaultRole, name: 'channel_user', permissions: [Permissions.READ_SPACE]},
                }}
                actions={{...defaultProps.actions, editRole}}
                ref={ref}
            />,
        );

        await act(async () => {
            await (ref.current as any).handleSubmit();
        });

        const savedRole = (name: string) => editRole.mock.calls.map((call) => call[0]).find((role) => role.name === name);

        // Every space permission is team_scope, so all four must survive the
        // all_users -> team_user filter. If any of them were missing from
        // PermissionsScope, PermissionsScope[p] would be undefined, fail the
        // === 'team_scope' check, and get filtered out here.
        expect(savedRole('team_user').permissions).toEqual(expect.arrayContaining([
            Permissions.READ_SPACE,
            Permissions.CREATE_SPACE,
            Permissions.MANAGE_SPACE,
            Permissions.DELETE_SPACE,
        ]));

        // READ_SPACE is team_scope, not channel_scope, so it must NOT survive the
        // all_users -> channel_user filter even though it was present on the
        // source channel_user role. This proves the filter discriminates by scope
        // value rather than merely by presence in the map.
        expect(savedRole('channel_user').permissions).not.toEqual(expect.arrayContaining([Permissions.READ_SPACE]));

        // Exactly once: the guest branch re-adds permissions the guest tree does not
        // manage, so read_space being both scope-mapped and tree-managed is what keeps
        // it from being appended a second time on every save.
        const guestPermissions = savedRole('team_guest').permissions;
        expect(guestPermissions.filter((p: string) => p === Permissions.READ_SPACE)).toHaveLength(1);
    });

    test('should save roles based on license', async () => {
        const license = {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'false',
            GuestAccountsPermissions: 'false',
        };
        let editRole = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                license={license}
                actions={{...defaultProps.actions, editRole}}
                ref={ref}
            />,
        );

        expect(container).toMatchSnapshot();

        await act(async () => {
            await (ref.current as any).handleSubmit();
        });
        expect(editRole).toHaveBeenCalledTimes(8);
        license.GuestAccountsPermissions = 'true';
        editRole = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
        const ref2 = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        const {container: container2} = renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                license={license}
                actions={{...defaultProps.actions, editRole}}
                ref={ref2}
            />,
        );

        expect(container2).toMatchSnapshot();

        await act(async () => {
            await (ref2.current as any).handleSubmit();
        });
        expect(editRole).toHaveBeenCalledTimes(11);
    });

    test('should show error if editRole fails', async () => {
        const editRole = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error'}}));
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                actions={{...defaultProps.actions, editRole}}
                ref={ref}
            />,
        );

        await act(async () => {
            await (ref.current as any).handleSubmit();
        });
        expect(ref.current!.state.serverError).toBe('test error');
    });

    test('should open and close correctly roles blocks', () => {
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                ref={ref}
            />,
        );
        const instance = ref.current as any;
        expect(ref.current!.state.openRoles.all_users).toBe(true);
        act(() => {
            instance.toggleRole('all_users');
        });
        expect(ref.current!.state.openRoles.all_users).toBe(false);
        act(() => {
            instance.toggleRole('all_users');
        });
        expect(ref.current!.state.openRoles.all_users).toBe(true);

        expect(ref.current!.state.openRoles.channel_admin).toBe(true);
        act(() => {
            instance.toggleRole('channel_admin');
        });
        expect(ref.current!.state.openRoles.channel_admin).toBe(false);
        act(() => {
            instance.toggleRole('channel_admin');
        });
        expect(ref.current!.state.openRoles.channel_admin).toBe(true);

        expect(ref.current!.state.openRoles.team_admin).toBe(true);
        act(() => {
            instance.toggleRole('team_admin');
        });
        expect(ref.current!.state.openRoles.team_admin).toBe(false);
        act(() => {
            instance.toggleRole('team_admin');
        });
        expect(ref.current!.state.openRoles.team_admin).toBe(true);

        expect(ref.current!.state.openRoles.system_admin).toBe(true);
        act(() => {
            instance.toggleRole('system_admin');
        });
        expect(ref.current!.state.openRoles.system_admin).toBe(false);
        act(() => {
            instance.toggleRole('system_admin');
        });
        expect(ref.current!.state.openRoles.system_admin).toBe(true);
    });

    test('should open modal on click reset defaults', () => {
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                ref={ref}
            />,
        );
        expect(ref.current!.state.showResetDefaultModal).toBe(false);
        const resetButton = container.querySelector('.btn-quaternary');
        expect(resetButton).not.toBeNull();
        act(() => {
            (resetButton as HTMLElement).click();
        });
        expect(ref.current!.state.showResetDefaultModal).toBe(true);
    });

    test('should have default permissions that match the defaults constant', () => {
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                ref={ref}
            />,
        );
        const instance = ref.current as any;
        expect(ref.current!.state.roles.all_users.permissions?.length).toBe(0);
        expect(ref.current!.state.roles.channel_admin.permissions?.length).toBe(0);
        expect(ref.current!.state.roles.team_admin.permissions?.length).toBe(0);
        act(() => {
            instance.resetDefaults();
        });
        expect(ref.current!.state.roles.all_users.permissions).toBe(DefaultRolePermissions.all_users);
        expect(ref.current!.state.roles.channel_admin.permissions).toBe(DefaultRolePermissions.channel_admin);
        expect(ref.current!.state.roles.team_admin.permissions).toBe(DefaultRolePermissions.team_admin);
        expect(ref.current!.state.roles.system_admin.permissions?.length).toBe(defaultProps.roles.system_admin.permissions.length);
    });

    test('should restore the space permissions the server grants by default', () => {
        // resetDefaults replaces each role's permissions wholesale, so anything
        // missing from DefaultRolePermissions is revoked on the next save. These
        // mirror MakeDefaultRoles: team_user gains read/create, team_admin gains
        // manage/delete, and team_guest gains read. Asserted by content rather
        // than against the constant itself, which would hold however it drifts.
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                ref={ref}
            />,
        );
        act(() => {
            (ref.current as any).resetDefaults();
        });

        expect(ref.current!.state.roles.all_users.permissions).toEqual(
            expect.arrayContaining([Permissions.READ_SPACE, Permissions.CREATE_SPACE]),
        );
        expect(ref.current!.state.roles.team_admin.permissions).toEqual(
            expect.arrayContaining([Permissions.MANAGE_SPACE, Permissions.DELETE_SPACE]),
        );
        expect(ref.current!.state.roles.guests.permissions).toEqual(
            expect.arrayContaining([Permissions.READ_SPACE]),
        );
    });

    test('should set moderated permissions on team/channel admins', () => {
        const ref = React.createRef<InstanceType<typeof PermissionSystemSchemeSettings>>();
        renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                ref={ref}
            />,
        );
        const instance = ref.current as any;

        // A moderated permission should set team/channel admins
        act(() => {
            instance.togglePermission('all_users', [Permissions.CREATE_POST]);
        });
        expect(ref.current!.state.roles.all_users.permissions.indexOf(Permissions.CREATE_POST)).toBeGreaterThan(-1);
        expect(ref.current!.state.roles.channel_admin.permissions.indexOf(Permissions.CREATE_POST)).toBeGreaterThan(-1);
        expect(ref.current!.state.roles.team_admin.permissions.indexOf(Permissions.CREATE_POST)).toBeGreaterThan(-1);
        expect(ref.current!.state.roles.playbook_admin.permissions.indexOf(Permissions.CREATE_POST)).toEqual(-1);

        // Changing a non-moderated permission should NOT set team/channel admins
        act(() => {
            instance.togglePermission('all_users', [Permissions.EDIT_OTHERS_POSTS]);
        });
        expect(ref.current!.state.roles.all_users.permissions.indexOf(Permissions.EDIT_OTHERS_POSTS)).toBeGreaterThan(-1);
        expect(ref.current!.state.roles.channel_admin.permissions.indexOf(Permissions.EDIT_OTHERS_POSTS)).toEqual(-1);
        expect(ref.current!.state.roles.team_admin.permissions.indexOf(Permissions.EDIT_OTHERS_POSTS)).toEqual(-1);
        expect(ref.current!.state.roles.playbook_admin.permissions.indexOf(Permissions.EDIT_OTHERS_POSTS)).toEqual(-1);
    });
});
