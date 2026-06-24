// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Role} from '@mattermost/types/roles';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ManageRolesModal, {DELEGATED_ROLE_NAMES} from './manage_roles_modal';

function buildRoles(names: string[] = DELEGATED_ROLE_NAMES): Record<string, Role> {
    return names.reduce<Record<string, Role>>((acc, name) => {
        acc[name] = TestHelper.getRoleMock({id: name, name});
        return acc;
    }, {});
}

function getBaseProps(userOverride: Partial<UserProfile> = {}) {
    const updateUserRoles = jest.fn().mockResolvedValue({data: true});
    const loadRolesIfNeeded = jest.fn().mockResolvedValue({data: {}});
    const onSuccess = jest.fn();
    const onExited = jest.fn();

    return {
        user: TestHelper.getUserMock({id: 'user_id', username: 'manager', roles: 'system_user', ...userOverride}),
        userAccessTokensEnabled: false,
        roles: buildRoles(),
        onSuccess,
        onExited,
        actions: {
            updateUserRoles,
            loadRolesIfNeeded,
        },
    };
}

async function clickSave() {
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
}

describe('admin_console/manage_roles_modal', () => {
    test('loads the delegated roles when mounted', () => {
        const props = getBaseProps();
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(props.actions.loadRolesIfNeeded).toHaveBeenCalledWith(DELEGATED_ROLE_NAMES);
    });

    test('renders a checkbox for every available delegated role, pre-checked from the user roles', () => {
        const props = getBaseProps({roles: 'system_user system_manager'});
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.getByText('Delegated Administration Roles')).toBeInTheDocument();

        expect(screen.getByRole('checkbox', {name: /System Manager/})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: /User Manager/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /Custom Group Manager/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /Shared Channel Manager/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /Viewer/})).not.toBeChecked();
    });

    test('only renders checkboxes for roles that are available in the store', () => {
        const props = {...getBaseProps(), roles: buildRoles(['system_manager'])};
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.getByRole('checkbox', {name: /System Manager/})).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', {name: /User Manager/})).not.toBeInTheDocument();
    });

    test('does not render the delegated roles section for bot accounts', () => {
        const props = getBaseProps({is_bot: true, roles: 'system_user'});
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.queryByText('Delegated Administration Roles')).not.toBeInTheDocument();
    });

    test('merges a newly checked delegated role into the saved roles', async () => {
        const props = getBaseProps({roles: 'system_user'});
        renderWithContext(<ManageRolesModal {...props}/>);

        await userEvent.click(screen.getByRole('checkbox', {name: /User Manager/}));
        await clickSave();

        await waitFor(() => {
            expect(props.actions.updateUserRoles).toHaveBeenCalledWith('user_id', 'system_user system_user_manager');
        });
        expect(props.onSuccess).toHaveBeenCalledWith('system_user system_user_manager');
    });

    test('removes an unchecked delegated role from the saved roles', async () => {
        const props = getBaseProps({roles: 'system_user system_manager'});
        renderWithContext(<ManageRolesModal {...props}/>);

        await userEvent.click(screen.getByRole('checkbox', {name: /System Manager/}));
        await clickSave();

        await waitFor(() => {
            expect(props.actions.updateUserRoles).toHaveBeenCalledWith('user_id', 'system_user');
        });
    });

    test('keeps delegated roles when toggling to System Admin and back to Member', async () => {
        const props = getBaseProps({roles: 'system_user system_manager'});
        renderWithContext(<ManageRolesModal {...props}/>);

        await userEvent.click(screen.getByRole('radio', {name: 'System Admin'}));
        await userEvent.click(screen.getByRole('radio', {name: 'Member'}));
        await clickSave();

        await waitFor(() => {
            expect(props.actions.updateUserRoles).toHaveBeenCalledWith('user_id', 'system_user system_manager');
        });
    });

    test('saves delegated roles alongside the System Admin role', async () => {
        const props = getBaseProps({roles: 'system_user system_manager'});
        renderWithContext(<ManageRolesModal {...props}/>);

        await userEvent.click(screen.getByRole('radio', {name: 'System Admin'}));
        await clickSave();

        await waitFor(() => {
            expect(props.actions.updateUserRoles).toHaveBeenCalledWith('user_id', 'system_user system_admin system_manager');
        });
    });
});
