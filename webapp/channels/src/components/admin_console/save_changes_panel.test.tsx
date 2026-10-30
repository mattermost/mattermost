// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createBrowserHistory} from 'history';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import type {GlobalState} from 'types/store';

import SaveChangesPanel from './save_changes_panel';

jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(),
}));

describe('components/admin_console/SaveChangesPanel', () => {
    const baseProps = {
        saving: false,
        saveNeeded: true,
        onClick: jest.fn(),
    };

    const push = jest.fn();

    beforeEach(() => {
        push.mockReset();
        (getHistory as jest.Mock).mockReturnValue({push});
    });

    function renderPanel(
        props: Partial<React.ComponentProps<typeof SaveChangesPanel>> & {cancelLink?: string; onCancel?: () => void} = {},
        options: {navigationBlocked?: boolean; history?: ReturnType<typeof createBrowserHistory>} = {},
    ) {
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
            <SaveChangesPanel
                {...baseProps}
                {...props}
            />,
            initialState,
            {history: options.history},
        );
    }

    test('renders Cancel as a tertiary compass-ui link when cancelLink is provided', () => {
        renderPanel({cancelLink: '/admin_console/user_management/teams'});

        const cancel = screen.getByRole('link', {name: 'Cancel'});
        expect(cancel).toBeInTheDocument();
        expect(cancel).toHaveAttribute('id', 'cancelButtonSettings');
        expect(cancel).toHaveAttribute('href', '/admin_console/user_management/teams');
        expect(cancel.tagName).toBe('A');
        expect(cancel.className).toMatch(/button--emphasis-tertiary/);
        expect(cancel.className).not.toMatch(/\bbtn-tertiary\b/);
        expect(cancel.className).not.toMatch(/\bbtn-quaternary\b/);
    });

    test('navigates immediately on Cancel when navigation is not blocked', async () => {
        const history = createBrowserHistory();
        const historyPush = jest.spyOn(history, 'push');
        renderPanel(
            {cancelLink: '/admin_console/user_management/teams'},
            {history},
        );

        await userEvent.click(screen.getByRole('link', {name: 'Cancel'}));

        expect(historyPush).toHaveBeenCalledWith(
            expect.objectContaining({pathname: '/admin_console/user_management/teams'}),
        );
    });

    test('defers Cancel navigation when navigation is blocked', async () => {
        const {store} = renderPanel(
            {cancelLink: '/admin_console/user_management/teams'},
            {navigationBlocked: true},
        );

        await userEvent.click(screen.getByRole('link', {name: 'Cancel'}));

        expect(push).not.toHaveBeenCalled();
        expect(store.getState().views.admin.navigationBlock.showNavigationPrompt).toBe(true);

        store.getState().views.admin.navigationBlock.onNavigationConfirmed?.();
        expect(push).toHaveBeenCalledWith('/admin_console/user_management/teams');
    });

    test('calls onCancel when provided instead of cancelLink', async () => {
        const onCancel = jest.fn();
        renderPanel({onCancel});

        const cancel = screen.getByRole('button', {name: 'Cancel'});
        expect(cancel.className).toMatch(/button--emphasis-tertiary/);

        await userEvent.click(cancel);
        expect(onCancel).toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
    });
});
