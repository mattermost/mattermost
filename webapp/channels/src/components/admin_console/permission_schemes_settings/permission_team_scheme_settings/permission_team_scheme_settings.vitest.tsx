// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import PermissionTeamSchemeSettings from './permission_team_scheme_settings';

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
            formatMessage: vi.fn(),
        },
        actions: {
            loadRolesIfNeeded: vi.fn().mockReturnValue(Promise.resolve()),
            loadRole: vi.fn(),
            loadScheme: vi.fn().mockReturnValue(Promise.resolve({data: true})),
            loadSchemeTeams: vi.fn(),
            editRole: vi.fn(),
            patchScheme: vi.fn(),
            createScheme: vi.fn(),
            updateTeamScheme: vi.fn(),
            setNavigationBlocked: vi.fn(),
        },
        history: {
            push: vi.fn(),
        },
    } as any;

    test('should match snapshot on new with default roles without permissions', () => {
        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on new with default roles with permissions', () => {
        const roles = {
            system_guest: {permissions: ['create_post']},
            team_guest: {permissions: ['invite_user']},
            channel_guest: {permissions: ['add_reaction']},
            system_user: {permissions: ['create_post']},
            team_user: {permissions: ['invite_user']},
            channel_user: {permissions: ['add_reaction']},
            system_admin: {permissions: ['manage_system']},
            team_admin: {permissions: ['add_user_to_team']},
            channel_admin: {permissions: ['delete_post']},
        };
        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings
                {...defaultProps}
                roles={roles}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should save each role on handleSubmit except system_admin role', () => {
        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should show error if createScheme fails', () => {
        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should show error if editRole fails', () => {
        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should open and close correctly roles blocks', () => {
        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on edit without permissions', () => {
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

        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on edit with permissions', () => {
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
                aaa: {permissions: ['invite_user']},
                bbb: {name: 'team_admin', permissions: ['add_user_to_team']},
                ccc: {permissions: ['add_reaction']},
                ddd: {name: 'channel_admin', permissions: ['delete_post']},
                eee: {permissions: ['edit_post']},
                fff: {permissions: ['delete_post']},
                ggg: {permissions: ['delete_post']},
                hhh: {permissions: ['delete_post']},
                iii: {permissions: ['delete_post']},
                jjj: {permissions: ['delete_post']},
            },
        };

        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on edit without guest permissions', () => {
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

        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on edit without license', () => {
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

        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should set moderated permissions on team/channel admins', () => {
        const {container} = renderWithContext(
            <PermissionTeamSchemeSettings {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
