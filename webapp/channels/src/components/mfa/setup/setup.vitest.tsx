// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setup from 'components/mfa/setup/setup';

import {renderWithContext, screen, fireEvent, act, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

vi.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: vi.fn(),
}));

describe('components/mfa/setup', () => {
    const user = TestHelper.getUserMock();
    const generateMfaSecret = vi.fn().mockImplementation(() => Promise.resolve({data: {secret: 'generated secret', qr_code: 'qrcode'}}));
    const activateMfa = vi.fn().mockImplementation(() => Promise.resolve({data: {}}));
    const baseProps = {
        state: {enforceMultifactorAuthentication: false},
        updateParent: vi.fn(),
        currentUser: user,
        siteName: 'test',
        enforceMultifactorAuthentication: false,
        actions: {
            activateMfa,
            generateMfaSecret,
        },
        history: {push: vi.fn()},
    };

    test('should match snapshot without required text', async () => {
        const {container} = renderWithContext(
            <Setup {...baseProps}/>,
        );

        // Wait for async generateMfaSecret to complete
        await waitFor(() => {
            expect(generateMfaSecret).toHaveBeenCalled();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with required text', async () => {
        const props = {
            ...baseProps,
            enforceMultifactorAuthentication: true,
        };

        const {container} = renderWithContext(
            <Setup {...props}/>,
        );

        // Wait for async generateMfaSecret to complete
        await waitFor(() => {
            expect(generateMfaSecret).toHaveBeenCalled();
        });

        // Required text should be present when enforcement is enabled
        expect(container).toMatchSnapshot();
    });

    test('should set state after calling component did mount', async () => {
        renderWithContext(
            <Setup {...baseProps}/>,
        );

        expect(generateMfaSecret).toHaveBeenCalled();

        // Wait for the secret to be loaded and displayed
        await waitFor(() => {
            expect(screen.getByText(/Secret:.*generated secret/)).toBeInTheDocument();
        });
    });

    test('should call activateMfa on submission', async () => {
        renderWithContext(
            <Setup {...baseProps}/>,
        );

        // Wait for component to mount and load
        await waitFor(() => {
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        const input = screen.getByRole('textbox');
        fireEvent.change(input, {target: {value: 'testcodeinput'}});

        const form = document.querySelector('form');
        if (form) {
            await act(async () => {
                fireEvent.submit(form);
            });
        }

        await waitFor(() => {
            expect(baseProps.actions.activateMfa).toHaveBeenCalledWith('testcodeinput');
        });
    });

    test('should focus input when code is empty', async () => {
        renderWithContext(
            <Setup {...baseProps}/>,
        );

        // Wait for component to mount and load
        await waitFor(() => {
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        const input = screen.getByRole('textbox') as HTMLInputElement;

        // Submit form without entering code
        const form = document.querySelector('form');
        if (form) {
            await act(async () => {
                fireEvent.submit(form);
            });
        }

        // Input should be focused when code is empty
        await waitFor(() => {
            expect(document.activeElement).toBe(input);
        });
    });

    test('should focus input when authentication fails', async () => {
        const failingActivateMfa = vi.fn().mockImplementation(() => Promise.resolve({
            error: {
                server_error_id: 'ent.mfa.activate.authenticate.app_error',
                message: 'Invalid code',
            },
        }));

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                activateMfa: failingActivateMfa,
            },
        };

        renderWithContext(
            <Setup {...props}/>,
        );

        // Wait for component to mount and load
        await waitFor(() => {
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        const input = screen.getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, {target: {value: 'invalidcode'}});

        const form = document.querySelector('form');
        if (form) {
            await act(async () => {
                fireEvent.submit(form);
            });
        }

        // Input should be focused after auth failure
        await waitFor(() => {
            expect(document.activeElement).toBe(input);
        });
    });
});
