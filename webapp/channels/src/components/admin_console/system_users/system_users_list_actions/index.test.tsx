// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor, screen, within} from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import type {UserProfile} from '@mattermost/types/users';

import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import {SystemUsersListAction} from './index';

jest.mock('mattermost-redux/selectors/entities/roles_helpers', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles_helpers'),
    haveISystemPermission: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/common', () => {
    const {TestHelper} = jest.requireActual('utils/test_helper');

    const currentUser = TestHelper.getUserMock({
        id: 'other_user_id',
        roles: 'system_admin',
        username: 'other-user',
    });

    return {
        ...jest.requireActual('mattermost-redux/selectors/entities/common') as typeof import('mattermost-redux/selectors/entities/users'),
        getCurrentUser: () => currentUser,
    };
});

describe('SystemUsersListAction Component', () => {
    const onError = jest.fn();
    const updateUser = jest.fn();
    beforeEach(() => {
        (haveISystemPermission as jest.Mock).mockImplementation(() => true);
    });

    const currentUser = TestHelper.getUserMock({
        id: 'other_user_id',
        roles: 'system_admin',
        username: 'other-user',
    });

    const user = Object.assign(TestHelper.getUserMock(), {auth_service: 'email'}) as UserProfile;
    const ldapUser = {...user, auth_service: Constants.LDAP_SERVICE} as UserProfile;
    const deactivatedLDAPUser = {...user, auth_service: Constants.LDAP_SERVICE, delete_at: 12345} as UserProfile;

    const renderComponent = (authServiceUser: UserProfile) => {
        renderWithContext(
            <SystemUsersListAction
                user={authServiceUser}
                currentUser={currentUser}
                tableId='testing'
                rowIndex={0}
                onError={onError}
                updateUser={updateUser}
            />,
        );
    };

    test('Deactivate button is disabled and contains the Managed by LDAP text when user authmethod is LDAP', async () => {
        renderComponent(ldapUser);

        // Find and click the menu button to open the menu
        const menuButton = screen.getByText('Member');

        await userEvent.click(menuButton);
        expect(
            await screen.findByRole('menuitem', {name: /deactivate/i}),
        ).toBeInTheDocument();

        // screen.debug();

        userEvent.click(menuButton);

        // Wait for the menu to open and find the "Activate" menu item
        await waitFor(() => {
            expect(screen.getByRole('menuitem', {name: /deactivate/i})).toBeInTheDocument();
        });

        // Verify the "Deactivate" menu item is present
        const deactivateMenuItem = await screen.findByRole('menuitem', {name: /deactivate/i});

        // Check if the aria-disabled is true
        expect(deactivateMenuItem).toHaveAttribute('aria-disabled', 'true');

        // Check if the class includes 'Mui-disabled'
        expect(deactivateMenuItem).toHaveClass('Mui-disabled');

        // Check if the trailing element contains "Managed by LDAP"
        expect(within(deactivateMenuItem).getByText(/Managed by LDAP/i)).toBeInTheDocument();
    });

    test('Activate button is disabled and contains the Managed by LDAP text when user authmethod is LDAP', async () => {
        renderComponent(deactivatedLDAPUser);

        // Find and click the menu button to open the menu
        const menuButton = screen.getByText('Deactivated');

        await userEvent.click(menuButton);
        expect(
            await screen.findByRole('menuitem', {name: /activate/i}),
        ).toBeInTheDocument();

        // screen.debug();

        userEvent.click(menuButton);

        // Wait for the menu to open and find the "Activate" menu item
        await waitFor(() => {
            expect(screen.getByRole('menuitem', {name: /activate/i})).toBeInTheDocument();
        });

        // Verify the "Activate" menu item is present
        const activateMenuItem = await screen.findByRole('menuitem', {name: /activate/i});

        // Check if the aria-disabled is true
        expect(activateMenuItem).toHaveAttribute('aria-disabled', 'true');

        // Check if the class includes 'Mui-disabled'
        expect(activateMenuItem).toHaveClass('Mui-disabled');

        // Check if the trailing element contains "Managed by LDAP"
        expect(within(activateMenuItem).getByText(/Managed by LDAP/i)).toBeInTheDocument();
    });

    test('element is enabled and that DO NOT contain the Managed by LDAP text when user authmethod is NOT LDAP', async () => {
        renderComponent(user);

        // Find and click the menu button to open the menu
        const menuButton = screen.getByText('Member');

        await userEvent.click(menuButton);
        expect(
            await screen.findByRole('menuitem', {name: /deactivate/i}),
        ).toBeInTheDocument();

        // screen.debug();

        userEvent.click(menuButton);

        // Wait for the menu to open and find the "Activate" menu item
        await waitFor(() => {
            expect(screen.getByRole('menuitem', {name: /deactivate/i})).toBeInTheDocument();
        });

        // Verify the "Deactivate" menu item is present
        const deactivateMenuItem = await screen.findByRole('menuitem', {name: /deactivate/i});

        // Check if the aria-disabled is true
        expect(deactivateMenuItem).not.toHaveAttribute('aria-disabled', 'true');

        // Check if the class includes 'Mui-disabled'
        expect(deactivateMenuItem).not.toHaveClass('Mui-disabled');

        // Check if the trailing element does NOT contain "Managed by LDAP"
        expect(within(deactivateMenuItem).queryByText(/Managed by LDAP/i)).not.toBeInTheDocument();
    });
});

