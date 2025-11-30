// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoginMfa from 'components/login/login_mfa';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

describe('components/login/LoginMfa', () => {
    const baseProps = {
        loginId: 'login_id',
        password: 'password',
        onSubmit: vi.fn(),
    };
    const token = '123456';

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <LoginMfa {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should handle token entered', () => {
        renderWithContext(
            <LoginMfa {...baseProps}/>,
        );

        const input = screen.getByRole('textbox');
        expect(input).not.toBeDisabled();

        const button = screen.getByRole('button', {name: /submit/i});
        expect(button).toBeDisabled();

        fireEvent.change(input, {target: {value: token}});

        // After entering token, button should be enabled
        expect(button).not.toBeDisabled();
        expect(input).toHaveValue(token);
    });

    test('should handle submit', () => {
        const onSubmit = vi.fn();
        renderWithContext(
            <LoginMfa
                {...baseProps}
                onSubmit={onSubmit}
            />,
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, {target: {value: token}});

        const button = screen.getByRole('button', {name: /submit/i});
        fireEvent.click(button);

        expect(onSubmit).toHaveBeenCalledWith({loginId: baseProps.loginId, password: baseProps.password, token});
    });
});
