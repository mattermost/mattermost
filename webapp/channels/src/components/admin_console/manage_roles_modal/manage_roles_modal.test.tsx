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
        isLicensedForDelegatedAdmin: true,
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

    test('does not save delegated roles when the account is set to System Admin', async () => {
        const props = getBaseProps({roles: 'system_user system_manager'});
        renderWithContext(<ManageRolesModal {...props}/>);

        await userEvent.click(screen.getByRole('radio', {name: 'System Admin'}));
        await clickSave();

        await waitFor(() => {
            expect(props.actions.updateUserRoles).toHaveBeenCalledWith('user_id', 'system_user system_admin');
        });
    });

    test('hides the delegated roles section when the account is a System Admin', () => {
        const props = getBaseProps({roles: 'system_user system_admin system_manager'});
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.queryByText('Delegated Administration Roles')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', {name: /System Manager/})).not.toBeInTheDocument();
    });

    test('hides the delegated roles section when toggling to System Admin', async () => {
        const props = getBaseProps({roles: 'system_user'});
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.getByText('Delegated Administration Roles')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('radio', {name: 'System Admin'}));

        expect(screen.queryByText('Delegated Administration Roles')).not.toBeInTheDocument();
    });

    test('renders the Personal Access Tokens section heading when tokens are enabled', () => {
        const props = {...getBaseProps({roles: 'system_user'}), userAccessTokensEnabled: true};
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.getByText('Personal Access Tokens')).toBeInTheDocument();
    });

    test('appends multiple selected delegated roles in a stable order', async () => {
        const props = getBaseProps({roles: 'system_user'});
        renderWithContext(<ManageRolesModal {...props}/>);

        // Click in reverse order to prove the saved order follows DELEGATED_ROLE_NAMES, not click order.
        await userEvent.click(screen.getByRole('checkbox', {name: /Viewer/}));
        await userEvent.click(screen.getByRole('checkbox', {name: /User Manager/}));
        await clickSave();

        await waitFor(() => {
            expect(props.actions.updateUserRoles).toHaveBeenCalledWith('user_id', 'system_user system_user_manager system_read_only_admin');
        });
    });

    test('does not grant a role that is checked and then unchecked before saving', async () => {
        const props = getBaseProps({roles: 'system_user'});
        renderWithContext(<ManageRolesModal {...props}/>);

        const checkbox = screen.getByRole('checkbox', {name: /User Manager/});
        await userEvent.click(checkbox);
        await userEvent.click(checkbox);
        await clickSave();

        await waitFor(() => {
            expect(props.actions.updateUserRoles).toHaveBeenCalledWith('user_id', 'system_user');
        });
    });

    test('does not render the delegated roles section without an enterprise license', () => {
        const props = {...getBaseProps({roles: 'system_user system_manager'}), isLicensedForDelegatedAdmin: false};
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.queryByText('Delegated Administration Roles')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', {name: /System Manager/})).not.toBeInTheDocument();
    });

    test('renders the delegated roles section with an enterprise license', () => {
        const props = {...getBaseProps({roles: 'system_user'}), isLicensedForDelegatedAdmin: true};
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.getByText('Delegated Administration Roles')).toBeInTheDocument();

        const link = screen.getByRole('link', {name: 'granular administration roles'});
        expect(link).toHaveAttribute('href', '/admin_console/user_management/system_roles');
        expect(screen.getByText(/Grant targeted System Console access without full System Admin privileges using/)).toBeInTheDocument();
    });

    test('does not render the delegated roles section when no delegated roles are available', () => {
        const props = {...getBaseProps({roles: 'system_user'}), roles: {}};
        renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.queryByText('Delegated Administration Roles')).not.toBeInTheDocument();
    });

    test('shows an error and does not report success when saving fails', async () => {
        const props = getBaseProps({roles: 'system_user'});
        props.actions.updateUserRoles.mockResolvedValue({error: {message: 'boom'}});
        renderWithContext(<ManageRolesModal {...props}/>);

        await userEvent.click(screen.getByRole('checkbox', {name: /User Manager/}));
        await clickSave();

        expect(await screen.findByText('Unable to save roles.')).toBeInTheDocument();
        expect(props.onSuccess).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    });

    test('closes the modal after a successful save', async () => {
        const props = getBaseProps({roles: 'system_user'});
        renderWithContext(<ManageRolesModal {...props}/>);

        await clickSave();

        await waitFor(() => {
            expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        });
    });

    test('resets the delegated role selection when a different user is provided', () => {
        const props = getBaseProps({id: 'user_1', roles: 'system_user system_manager'});
        const {rerender} = renderWithContext(<ManageRolesModal {...props}/>);

        expect(screen.getByRole('checkbox', {name: /System Manager/})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: /User Manager/})).not.toBeChecked();

        const nextProps = {
            ...props,
            user: TestHelper.getUserMock({id: 'user_2', username: 'other', roles: 'system_user system_user_manager'}),
        };
        rerender(<ManageRolesModal {...nextProps}/>);

        expect(screen.getByRole('checkbox', {name: /System Manager/})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: /User Manager/})).toBeChecked();
    });
});
