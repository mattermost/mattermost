// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoginMfa from 'components/login/login_mfa';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/login/LoginMfa', () => {
    const baseProps = {
        loginId: 'login_id',
        password: 'password',
        onSubmit: jest.fn(),
    };
    const token = '123456';

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <LoginMfa {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should handle token entered', async () => {
        renderWithContext(
            <LoginMfa {...baseProps}/>,
        );

        const input = screen.getByLabelText('MFA Token');
        expect(input).not.toBeDisabled();

        const button = screen.getByRole('button', {name: 'Submit'});
        expect(button).toBeDisabled();

        await userEvent.type(input, token);

        expect(screen.getByRole('button', {name: 'Submit'})).not.toBeDisabled();

        expect(input).toHaveValue(token);
    });

    test('should handle submit', async () => {
        renderWithContext(
            <LoginMfa {...baseProps}/>,
        );

        const input = screen.getByLabelText('MFA Token');
        await userEvent.type(input, token);

        await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

        // After submit, input should be disabled (saving state)
        expect(input).toBeDisabled();

        expect(baseProps.onSubmit).toHaveBeenCalledWith({loginId: baseProps.loginId, password: baseProps.password, token});
    });
});
