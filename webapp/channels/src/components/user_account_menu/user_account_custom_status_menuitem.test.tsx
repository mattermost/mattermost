// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CustomStatusDuration} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';

import UserAccountCustomStatusMenuItem from './user_account_custom_status_menuitem';

describe('UserAccountCustomStatusMenuItem', () => {
    const customStatus = {
        emoji: 'calendar',
        text: 'In a meeting',
        duration: CustomStatusDuration.DONT_CLEAR,
    };

    // Menu item onClick handlers run immediately in mobile view instead of after the menu close animation
    const mobileViewState = {
        views: {
            browser: {
                windowSize: WindowSizes.MOBILE_VIEW,
            },
        },
    };

    let openCustomStatusModal: jest.Mock;
    let unsetCustomStatus: jest.SpyInstance;

    beforeEach(() => {
        openCustomStatusModal = jest.fn();
        unsetCustomStatus = jest.spyOn(Client4, 'unsetCustomStatus').mockResolvedValue({status: 'OK'});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderMenuItem() {
        return renderWithContext(
            <UserAccountCustomStatusMenuItem
                customStatus={customStatus}
                openCustomStatusModal={openCustomStatusModal}
            />,
            mobileViewState,
        );
    }

    test('exposes the clear control as a labelled button', () => {
        renderMenuItem();

        const clearButton = screen.getByRole('button', {name: 'Clear custom status'});
        expect(clearButton.tagName).toBe('BUTTON');
        expect(clearButton).toHaveAttribute('type', 'button');
    });

    test('does not render the clear button when no custom status is set', () => {
        renderWithContext(
            <UserAccountCustomStatusMenuItem openCustomStatusModal={openCustomStatusModal}/>,
            mobileViewState,
        );

        expect(screen.queryByRole('button', {name: 'Clear custom status'})).not.toBeInTheDocument();
    });

    test('clicking the clear button clears the status without opening the status modal', async () => {
        renderMenuItem();

        await userEvent.click(screen.getByRole('button', {name: 'Clear custom status'}));

        expect(unsetCustomStatus).toHaveBeenCalledTimes(1);
        expect(openCustomStatusModal).not.toHaveBeenCalled();
    });

    test.each([
        ['Enter', '{Enter}'],
        ['Space', ' '],
    ])('pressing %s on the focused clear button clears the status without opening the status modal', async (_name, key) => {
        renderMenuItem();

        screen.getByRole('button', {name: 'Clear custom status'}).focus();
        await userEvent.keyboard(key);

        expect(unsetCustomStatus).toHaveBeenCalledTimes(1);
        expect(openCustomStatusModal).not.toHaveBeenCalled();
    });

    test('activating the menu item itself still opens the status modal', async () => {
        renderMenuItem();

        await userEvent.click(screen.getByRole('menuitem'));

        expect(openCustomStatusModal).toHaveBeenCalledTimes(1);
        expect(unsetCustomStatus).not.toHaveBeenCalled();
    });
});
