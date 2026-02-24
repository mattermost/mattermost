// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setup from 'components/mfa/setup/setup';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: jest.fn(),
}));

describe('components/mfa/setup', () => {
    const user = TestHelper.getUserMock();
    const generateMfaSecret = jest.fn().mockImplementation(() => Promise.resolve({data: {secret: 'generated secret', qr_code: 'qrcode'}}));
    const activateMfa = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
    const baseProps = {
        state: {enforceMultifactorAuthentication: false},
        updateParent: jest.fn(),
        currentUser: user,
        siteName: 'test',
        enforceMultifactorAuthentication: false,
        actions: {
            activateMfa,
            generateMfaSecret,
        },
        history: {push: jest.fn()},
    };

    test('should match snapshot without required text', async () => {
        const {container} = renderWithContext(
            <Setup {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
        const requiredText = screen.queryByText(/Multi-factor authentication is required/);
        expect(requiredText).not.toBeInTheDocument();
    });

    test('should match snapshot with required text', async () => {
        const props = {
            ...baseProps,
            enforceMultifactorAuthentication: true,
        };

        renderWithContext(
            <Setup {...props}/>,
        );
        const requiredText = screen.queryByText(/Multi-factor authentication is required/);
        expect(requiredText).toBeDefined();
    });

    test('should set state after calling component did mount', async () => {
        renderWithContext(
            <Setup {...baseProps}/>,
        );
        expect(generateMfaSecret).toHaveBeenCalled();

        await waitFor(() => {
            expect(screen.getByText(/generated secret/)).toBeInTheDocument();
        });
    });

    test('should call activateMfa on submission', async () => {
        renderWithContext(
            <Setup {...baseProps}/>,
        );

        const input = screen.getByPlaceholderText('MFA Code');
        await userEvent.type(input, 'testcodeinput');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(baseProps.actions.activateMfa).toHaveBeenCalledWith('testcodeinput');
        });
    });

    test('should focus input when code is empty', async () => {
        renderWithContext(
            <Setup {...baseProps}/>,
        );
        const input = screen.getByPlaceholderText('MFA Code');

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(input).toHaveFocus();
        });
    });

    test('should focus input when authentication fails', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                activateMfa: jest.fn().mockImplementation(() => Promise.resolve({
                    error: {
                        server_error_id: 'ent.mfa.activate.authenticate.app_error',
                        message: 'Invalid code',
                    },
                })),
            },
        };

        renderWithContext(
            <Setup {...props}/>,
        );
        const input = screen.getByPlaceholderText('MFA Code');

        await userEvent.type(input, 'invalidcode');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(input).toHaveFocus();
        });
    });
});
