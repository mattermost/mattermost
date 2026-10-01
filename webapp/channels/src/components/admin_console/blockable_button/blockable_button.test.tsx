// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import type {GlobalState} from 'types/store';

import BlockableButton from './blockable_button';

jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(),
}));

describe('components/admin_console/BlockableButton', () => {
    const push = jest.fn();

    beforeEach(() => {
        push.mockReset();
        (getHistory as jest.Mock).mockReturnValue({push});
    });

    function renderButton(options: {navigationBlocked?: boolean} = {}) {
        const initialState: DeepPartial<GlobalState> = {
            views: {
                admin: {
                    navigationBlock: {
                        blocked: options.navigationBlocked ?? false,
                        onNavigationConfirmed: undefined,
                        showNavigationPrompt: false,
                    },
                },
            },
        };

        return renderWithContext(
            <BlockableButton to='/admin_console/user_management/teams'>
                {'Cancel'}
            </BlockableButton>,
            initialState,
        );
    }

    test('renders as a tertiary compass-ui button', () => {
        renderButton();

        const cancel = screen.getByRole('button', {name: 'Cancel'});
        expect(cancel.className).toMatch(/button--emphasis-tertiary/);
    });

    test('navigates immediately when navigation is not blocked', async () => {
        renderButton();

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(push).toHaveBeenCalledWith('/admin_console/user_management/teams');
    });

    test('defers navigation when navigation is blocked', async () => {
        const {store} = renderButton({navigationBlocked: true});

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(push).not.toHaveBeenCalled();
        expect(store.getState().views.admin.navigationBlock.showNavigationPrompt).toBe(true);

        store.getState().views.admin.navigationBlock.onNavigationConfirmed?.();
        expect(push).toHaveBeenCalledWith('/admin_console/user_management/teams');
    });
});
