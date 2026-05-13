// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PasswordResetForm from './password_reset_form';

describe('components/PasswordResetForm', () => {
    const baseProps = {
        location: {
            search: '',
        },
        siteName: 'Mattermost',
        actions: {
            resetUserPassword: jest.fn().mockResolvedValue({data: true}),
        },
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(<PasswordResetForm {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    it('should call the resetUserPassword() action on submit', async () => {
        const props = {
            ...baseProps,
            location: {
                search: '?token=TOKEN',
            },
        };

        renderWithContext(<PasswordResetForm {...props}/>);

        const passwordInput = screen.getByPlaceholderText('Password');
        await userEvent.type(passwordInput, 'PASSWORD');

        await userEvent.click(screen.getByText('Change my password'));

        expect(props.actions.resetUserPassword).toHaveBeenCalledWith('TOKEN', 'PASSWORD');
    });
});
