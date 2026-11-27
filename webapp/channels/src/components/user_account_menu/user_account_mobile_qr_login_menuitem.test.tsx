// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {openModal} from 'actions/views/modals';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import UserAccountMenu from './index';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

describe('UserAccountMenu mobile QR login item', () => {
    const user = TestHelper.getUserMock({id: 'user1'});

    const makeState = (enableMobileQRLogin?: string) => ({
        entities: {
            general: {
                config: {
                    EnableCustomUserStatuses: 'false',
                    ...(enableMobileQRLogin === undefined ? {} : {EnableMobileQRLogin: enableMobileQRLogin}),
                },
            },
            users: {
                currentUserId: user.id,
                profiles: {[user.id]: user},
                statuses: {[user.id]: 'online'},
            },
        },
    }) as unknown as GlobalState;

    afterEach(() => {
        jest.clearAllMocks();
    });

    const openMenu = async () => {
        await userEvent.click(screen.getByRole('button', {name: "User's account menu"}));
    };

    test('is shown when the feature is enabled', async () => {
        renderWithContext(<UserAccountMenu/>, makeState('true'));
        await openMenu();

        expect(screen.getByRole('menuitem', {name: 'Sign in on mobile'})).toBeInTheDocument();
    });

    test.each([
        ['false'],
        [undefined],
    ])('is hidden when EnableMobileQRLogin is %s', async (value) => {
        renderWithContext(<UserAccountMenu/>, makeState(value));
        await openMenu();

        expect(screen.getByRole('menuitem', {name: /Profile/})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Sign in on mobile'})).not.toBeInTheDocument();
    });

    test('opens the mobile QR login modal when clicked', async () => {
        renderWithContext(<UserAccountMenu/>, makeState('true'));
        await openMenu();

        await userEvent.click(screen.getByRole('menuitem', {name: 'Sign in on mobile'}));

        await waitFor(() => {
            expect(openModal).toHaveBeenCalledWith(expect.objectContaining({modalId: ModalIdentifiers.MOBILE_QR_LOGIN}));
        });
    });
});
