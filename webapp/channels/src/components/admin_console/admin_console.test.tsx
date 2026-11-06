// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Redirect} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import type {Role} from '@mattermost/types/roles';

import {renderWithContext} from 'tests/react_testing_utils';

import AdminConsole from './admin_console';
import type {Props} from './admin_console';

jest.mock('react-router-dom', () => {
    const original = jest.requireActual('react-router-dom');

    return {
        ...original,
        Redirect: jest.fn(() => null),
    };
});

jest.mock('components/common/hooks/useAdminConfigSync', () => jest.fn());

const mainRoles = ['channel_user', 'team_user', 'system_user', 'channel_admin', 'team_admin', 'system_admin', 'system_user_manager', 'system_custom_group_admin', 'system_read_only_admin', 'system_manager', 'system_shared_channel_manager'].
    reduce<Record<string, Role>>((roles, name) => ({...roles, [name]: {name} as Role}), {});

describe('components/AdminConsole route guard', () => {
    const baseProps = {
        config: {},
        environmentConfig: {},
        license: {},
        buildEnterpriseReady: false,
        unauthorizedRoute: '/team/channels/town-square',
        showNavigationPrompt: false,
        isCurrentUserSystemAdmin: false,
        currentUserHasAnAdminRole: false,
        delegatedPermissionsLoaded: true,
        hasAnyDelegatedPermission: false,
        delegatedPermissions: [],
        roles: mainRoles,
        adminDefinition: {},
        consoleAccess: {read: {}, write: {}},
        cloud: {},
        team: undefined,
        actions: {
            getConfig: jest.fn(),
            getEnvironmentConfig: jest.fn(),
            fetchDelegatedPermissions: jest.fn(),
            patchConfig: jest.fn(),
            setNavigationBlocked: jest.fn(),
            deferNavigation: jest.fn(),
            cancelNavigation: jest.fn(),
            confirmNavigation: jest.fn(),
            loadRolesIfNeeded: jest.fn(),
            editRole: jest.fn(),
            selectLhsItem: jest.fn(),
            selectTeam: jest.fn(),
            setAdminConsoleUsersManagementTableProperties: jest.fn(),
        },
        match: {url: '/admin_console', path: '/admin_console', params: {}, isExact: true},
        location: {pathname: '/admin_console', search: '', hash: '', state: undefined},
        history: {} as RouteComponentProps['history'],
    } as unknown as Props;

    afterEach(() => {
        jest.mocked(Redirect).mockClear();
    });

    test('fetches the delegated permission set on load', () => {
        const props = {...baseProps, actions: {...baseProps.actions, fetchDelegatedPermissions: jest.fn()}};

        renderWithContext(<AdminConsole {...props}/>);

        expect(props.actions.fetchDelegatedPermissions).toHaveBeenCalled();
    });

    test('waits for the delegated permission set before redirecting a user without an admin role', () => {
        const {container} = renderWithContext(
            <AdminConsole
                {...baseProps}
                delegatedPermissionsLoaded={false}
            />,
        );

        expect(Redirect).not.toHaveBeenCalled();
        expect(container).toBeEmptyDOMElement();
    });

    test('redirects a user with neither an admin role nor a delegated permission', () => {
        renderWithContext(<AdminConsole {...baseProps}/>);

        expect(jest.mocked(Redirect).mock.calls[0][0]).toEqual({to: baseProps.unauthorizedRoute});
    });

    test('admits a delegate without an admin role', () => {
        const {container} = renderWithContext(
            <AdminConsole
                {...baseProps}
                hasAnyDelegatedPermission={true}
                delegatedPermissions={['create_compliance_export_job']}
            />,
        );

        expect(Redirect).not.toHaveBeenCalled();
        expect(container).not.toBeEmptyDOMElement();
    });

    test('admits an admin role holder without waiting for the delegated permission set', () => {
        const {container} = renderWithContext(
            <AdminConsole
                {...baseProps}
                currentUserHasAnAdminRole={true}
                delegatedPermissionsLoaded={false}
            />,
        );

        expect(Redirect).not.toHaveBeenCalled();
        expect(container).not.toBeEmptyDOMElement();
    });
});
