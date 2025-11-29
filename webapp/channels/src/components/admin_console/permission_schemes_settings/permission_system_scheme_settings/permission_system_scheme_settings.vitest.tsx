// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Role} from '@mattermost/types/roles';

import PermissionSystemSchemeSettings from 'components/admin_console/permission_schemes_settings/permission_system_scheme_settings/permission_system_scheme_settings';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

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
            loadRolesIfNeeded: vi.fn().mockReturnValue(Promise.resolve()),
            editRole: vi.fn(),
            setNavigationBlocked: vi.fn(),
        },
    };

    test('should match snapshot on roles without permissions', () => {
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when the license doesnt have custom schemes', () => {
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
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on roles with permissions', () => {
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
        };
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                roles={roles}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should save each role on handleSubmit except system_admin role', () => {
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should save roles based on license', () => {
        const license = {
            IsLicensed: 'true',
            CustomPermissionsSchemes: 'false',
            GuestAccountsPermissions: 'false',
        };
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings
                {...defaultProps}
                license={license}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should show error if editRole fails', () => {
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should open and close correctly roles blocks', () => {
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should open modal on click reset defaults', () => {
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have default permissions that match the defaults constant', () => {
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should set moderated permissions on team/channel admins', () => {
        const {container} = renderWithContext(
            <PermissionSystemSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
