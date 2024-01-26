// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Role} from '@mattermost/types/roles';

import PermissionSystemSchemeSettings from 'components/admin_console/permission_schemes_settings/permission_system_scheme_settings/permission_system_scheme_settings';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {DefaultRolePermissions} from 'utils/constants';

function getAnyInstance(wrapper: any) {
    return wrapper.instance() as any;
}

function getAnyState(wrapper: any) {
    return wrapper.state() as any;
}

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
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        defaultProps.actions.loadRolesIfNeeded().then(() => {
            expect(getAnyState(wrapper)).toMatchSnapshot();
            done();
        });
    });

    test('should match snapshot when the license doesnt have custom schemes', (done) => {
        const license = {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'false',
        };
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                license={license}
            />,
        );
        defaultProps.actions.loadRolesIfNeeded().then(() => {
            expect(wrapper).toMatchSnapshot();
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
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                roles={roles}
            />,
        );

        expect(wrapper).toMatchSnapshot();
        defaultProps.actions.loadRolesIfNeeded().then(() => {
            expect(getAnyState(wrapper)).toMatchSnapshot();
            done();
        });
    });

    test('should save each role on handleSubmit except system_admin role', async () => {
        const editRole = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                actions={{...defaultProps.actions, editRole}}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        await getAnyInstance(wrapper).handleSubmit();
        expect(editRole).toHaveBeenCalledTimes(11);
    });

    test('should save roles based on license', async () => {
        const license = {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'false',
            GuestAccountsPermissions: 'false',
        };
        let editRole = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                license={license}
                actions={{...defaultProps.actions, editRole}}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        await getAnyInstance(wrapper).handleSubmit();
        expect(editRole).toHaveBeenCalledTimes(8);
        license.GuestAccountsPermissions = 'true';
        editRole = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
        const wrapper2 = shallowWithIntl(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                license={license}
                actions={{...defaultProps.actions, editRole}}
            />,
        );

        expect(wrapper2).toMatchSnapshot();

        await getAnyInstance(wrapper2).handleSubmit();
        expect(editRole).toHaveBeenCalledTimes(11);
    });

    test('should show error if editRole fails', async () => {
        const editRole = jest.fn().mockImplementation(() => Promise.resolve({error: {message: 'test error'}}));
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                actions={{...defaultProps.actions, editRole}}
            />,
        );

        await getAnyInstance(wrapper).handleSubmit();
        await expect(getAnyState(wrapper).serverError).toBe('test error');
    });

    test('should open and close correctly roles blocks', () => {
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        const instance = getAnyInstance(wrapper);
        expect(getAnyState(wrapper).openRoles.all_users).toBe(true);
        instance.toggleRole('all_users');
        expect(getAnyState(wrapper).openRoles.all_users).toBe(false);
        instance.toggleRole('all_users');
        expect(getAnyState(wrapper).openRoles.all_users).toBe(true);

        expect(getAnyState(wrapper).openRoles.channel_admin).toBe(true);
        instance.toggleRole('channel_admin');
        expect(getAnyState(wrapper).openRoles.channel_admin).toBe(false);
        instance.toggleRole('channel_admin');
        expect(getAnyState(wrapper).openRoles.channel_admin).toBe(true);

        expect(getAnyState(wrapper).openRoles.team_admin).toBe(true);
        instance.toggleRole('team_admin');
        expect(getAnyState(wrapper).openRoles.team_admin).toBe(false);
        instance.toggleRole('team_admin');
        expect(getAnyState(wrapper).openRoles.team_admin).toBe(true);

        expect(getAnyState(wrapper).openRoles.system_admin).toBe(true);
        instance.toggleRole('system_admin');
        expect(getAnyState(wrapper).openRoles.system_admin).toBe(false);
        instance.toggleRole('system_admin');
        expect(getAnyState(wrapper).openRoles.system_admin).toBe(true);
    });

    test('should open modal on click reset defaults', () => {
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(getAnyState(wrapper).showResetDefaultModal).toBe(false);
        wrapper.find('.btn-quaternary').first().simulate('click');
        expect(getAnyState(wrapper).showResetDefaultModal).toBe(true);
    });

    test('should have default permissions that match the defaults constant', () => {
        const wrapper = shallowWithIntl(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(getAnyState(wrapper).roles.all_users.permissions?.length).toBe(0);
        expect(getAnyState(wrapper).roles.channel_admin.permissions?.length).toBe(0);
        expect(getAnyState(wrapper).roles.team_admin.permissions?.length).toBe(0);
        getAnyInstance(wrapper).resetDefaults();
        expect(getAnyState(wrapper).roles.all_users.permissions).toBe(DefaultRolePermissions.all_users);
        expect(getAnyState(wrapper).roles.channel_admin.permissions).toBe(DefaultRolePermissions.channel_admin);
        expect(getAnyState(wrapper).roles.team_admin.permissions).toBe(DefaultRolePermissions.team_admin);
        expect(getAnyState(wrapper).roles.system_admin.permissions?.length).toBe(defaultProps.roles.system_admin.permissions.length);
    });
});
