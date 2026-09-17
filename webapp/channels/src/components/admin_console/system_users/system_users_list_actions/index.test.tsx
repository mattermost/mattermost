// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor, screen, within} from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import General from 'mattermost-redux/constants/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

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

    const currentUser = TestHelper.getUserMock({
        id: 'other_user_id',
        roles: 'system_admin',
        username: 'other-user',
    });

    const user = Object.assign(TestHelper.getUserMock(), {auth_service: 'email'}) as UserProfile;
    const ldapUser = {...user, auth_service: Constants.LDAP_SERVICE} as UserProfile;
    const deactivatedLDAPUser = {...user, auth_service: Constants.LDAP_SERVICE, delete_at: 12345} as UserProfile;
    const memberUser = {...user, roles: General.SYSTEM_USER_ROLE} as UserProfile;
    const guestUser = {...user, roles: General.SYSTEM_GUEST_ROLE} as UserProfile;
    const userManager = TestHelper.getUserMock({id: 'user_manager_id', roles: 'system_user_manager'});

    // Guest accounts have to be licensed and enabled for "Demote to guest" to be offered at all.
    const guestAccountsEnabledState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                license: {IsLicensed: 'true'},
            },
            admin: {
                config: {
                    GuestAccountsSettings: {Enable: true},
                },
            },
        },
    };

    beforeEach(() => {
        (haveISystemPermission as jest.Mock).mockImplementation(() => true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = (listedUser: UserProfile, initialState?: DeepPartial<GlobalState>, viewer = currentUser) => {
        return renderWithContext(
            <SystemUsersListAction
                user={listedUser}
                currentUser={viewer}
                tableId='testing'
                rowIndex={0}
                onError={onError}
                updateUser={updateUser}
            />,
            initialState,
        );
    };

    const openMenu = async (buttonText: string) => {
        await userEvent.click(screen.getByText(buttonText));
        return screen.findByRole('menu');
    };

    const getOpenModalIds = (state: GlobalState) => {
        return Object.keys(state.views.modals.modalState).filter((modalId) => state.views.modals.modalState[modalId].open);
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

    test('a guest is only offered "Promote to member", never "Manage roles"', async () => {
        renderComponent(guestUser, guestAccountsEnabledState);

        const menu = await openMenu('Guest');

        expect(within(menu).queryByRole('menuitem', {name: /manage roles/i})).not.toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /promote to member/i})).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', {name: /demote to guest/i})).not.toBeInTheDocument();
    });

    test('a member is still offered "Manage roles" and "Demote to guest"', async () => {
        renderComponent(memberUser, guestAccountsEnabledState);

        const menu = await openMenu('Member');

        expect(within(menu).getByRole('menuitem', {name: /manage roles/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /demote to guest/i})).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', {name: /promote to member/i})).not.toBeInTheDocument();
    });

    test('a user holding both the guest and system admin roles is treated as a guest', async () => {
        renderComponent({...user, roles: `${General.SYSTEM_GUEST_ROLE} ${General.SYSTEM_ADMIN_ROLE}`} as UserProfile);

        // The row button reports the higher-priority System Admin role, so the guest exclusion cannot key off the label.
        const menu = await openMenu('System Admin');

        expect(within(menu).queryByRole('menuitem', {name: /manage roles/i})).not.toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /promote to member/i})).toBeInTheDocument();
    });

    test('a deactivated guest is not offered "Manage roles" either', async () => {
        renderComponent({...guestUser, delete_at: 12345} as UserProfile);

        const menu = await openMenu('Deactivated');

        expect(within(menu).queryByRole('menuitem', {name: /manage roles/i})).not.toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /promote to member/i})).toBeInTheDocument();
    });

    test('"Manage roles" is hidden from a viewer who is not a system admin', async () => {
        renderComponent(memberUser, undefined, userManager);

        const menu = await openMenu('Member');

        expect(within(menu).queryByRole('menuitem', {name: /manage roles/i})).not.toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /manage teams/i})).toBeInTheDocument();
    });

    test('a guest can still be promoted by a viewer who is not a system admin', async () => {
        renderComponent(guestUser, undefined, userManager);

        const menu = await openMenu('Guest');

        expect(within(menu).getByRole('menuitem', {name: /promote to member/i})).toBeInTheDocument();
    });

    test('"Promote to member" remains available without a license or guest accounts enabled', async () => {
        renderComponent(guestUser);

        const menu = await openMenu('Guest');

        expect(within(menu).getByRole('menuitem', {name: /promote to member/i})).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', {name: /manage roles/i})).not.toBeInTheDocument();
    });

    test('promoting a guest opens the promote confirmation, not the manage roles modal', async () => {
        const {store} = renderComponent(guestUser);

        const menu = await openMenu('Guest');
        await userEvent.click(within(menu).getByRole('menuitem', {name: /promote to member/i}));

        await waitFor(() => {
            expect(getOpenModalIds(store.getState())).toEqual([ModalIdentifiers.PROMOTE_TO_MEMBER_MODAL]);
        });
    });

    test('managing roles for a member opens the manage roles modal', async () => {
        const {store} = renderComponent(memberUser);

        const menu = await openMenu('Member');
        await userEvent.click(within(menu).getByRole('menuitem', {name: /manage roles/i}));

        await waitFor(() => {
            expect(getOpenModalIds(store.getState())).toEqual([ModalIdentifiers.MANAGE_ROLES_MODAL]);
        });
    });
});
