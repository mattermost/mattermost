// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';

import {renderWithContext, screen, waitFor, within, userEvent} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import {SystemUsersListAction} from './index';

vi.mock('mattermost-redux/selectors/entities/roles_helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('mattermost-redux/selectors/entities/roles_helpers')>();
    return {
        ...actual,
        haveISystemPermission: vi.fn(),
    };
});

vi.mock('mattermost-redux/selectors/entities/common', async () => {
    const {TestHelper: TH} = await import('utils/test_helper');
    const currentUser = TH.getUserMock({
        id: 'other_user_id',
        roles: 'system_admin',
        username: 'other-user',
    });

    const actual = await vi.importActual<typeof import('mattermost-redux/selectors/entities/common')>('mattermost-redux/selectors/entities/common');
    return {
        ...actual,
        getCurrentUser: () => currentUser,
    };
});

describe('SystemUsersListAction Component', () => {
    const onError = vi.fn();
    const updateUser = vi.fn();

    const currentUser = TestHelper.getUserMock({
        id: 'other_user_id',
        roles: 'system_admin',
        username: 'other-user',
    });

    const user = Object.assign(TestHelper.getUserMock(), {auth_service: 'email'}) as UserProfile;
    const ldapUser = {...user, auth_service: Constants.LDAP_SERVICE} as UserProfile;
    const deactivatedLDAPUser = {...user, auth_service: Constants.LDAP_SERVICE, delete_at: 12345} as UserProfile;

    beforeEach(() => {
        vi.mocked(haveISystemPermission).mockImplementation(() => true);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

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

    const openMenuAndFindItem = async (buttonText: string, itemText: RegExp) => {
        const menuButton = screen.getByText(buttonText);
        await userEvent.click(menuButton);
        await waitFor(() => {
            expect(screen.getByRole('menuitem', {name: itemText})).toBeInTheDocument();
        });
        return screen.findByRole('menuitem', {name: itemText});
    };

    const verifyDisabledMenuItem = (menuItem: HTMLElement, disabledText: RegExp) => {
        expect(menuItem).toHaveAttribute('aria-disabled', 'true');
        expect(menuItem).toHaveClass('Mui-disabled');
        expect(within(menuItem).getByText(disabledText)).toBeInTheDocument();
    };

    test('Deactivate button is disabled and contains the Managed by LDAP text when user authmethod is LDAP', async () => {
        renderComponent(ldapUser);

        const deactivateMenuItem = await openMenuAndFindItem('Member', /deactivate/i);

        // Verify that the item is disabled and contains "Managed by LDAP"
        verifyDisabledMenuItem(deactivateMenuItem, /Managed by LDAP/i);
    });

    test('Activate button is disabled and contains the Managed by LDAP text when user authmethod is LDAP', async () => {
        renderComponent(deactivatedLDAPUser);

        const activateMenuItem = await openMenuAndFindItem('Deactivated', /activate/i);

        // Verify that the item is disabled and contains "Managed by LDAP"
        verifyDisabledMenuItem(activateMenuItem, /Managed by LDAP/i);
    });

    test('element is enabled and does NOT contain the Managed by LDAP text when user authmethod is NOT LDAP', async () => {
        renderComponent(user);

        const deactivateMenuItem = await openMenuAndFindItem('Member', /deactivate/i);

        // Check if the item is enabled and does NOT contain "Managed by LDAP"
        expect(deactivateMenuItem).not.toHaveAttribute('aria-disabled', 'true');
        expect(deactivateMenuItem).not.toHaveClass('Mui-disabled');
        expect(within(deactivateMenuItem).queryByText(/Managed by LDAP/i)).not.toBeInTheDocument();
    });
});
