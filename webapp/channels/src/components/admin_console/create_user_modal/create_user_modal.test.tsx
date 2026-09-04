// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import CreateUserModal from './create_user_modal';

const historyMock = (global as any).historyMock; // eslint-disable-line @typescript-eslint/no-explicit-any

const createdUser = TestHelper.getUserMock({id: 'new_user_id'});

const passwordConfig = {
    minimumLength: 5,
    requireLowercase: false,
    requireNumber: false,
    requireSymbol: false,
    requireUppercase: false,
};

describe('components/admin_console/create_user_modal/create_user_modal.tsx', () => {
    const baseProps = {
        onExited: jest.fn(),
        passwordConfig,
        actions: {createUser: jest.fn(() => Promise.resolve({data: createdUser}))},
    };

    test('should render the modal with the create user fields', () => {
        renderWithContext(
            <CreateUserModal {...baseProps}/>,
        );

        expect(screen.getByText('Create user', {selector: '.GenericModal__header h1'})).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    test('should not create the user when email is invalid', async () => {
        const createUser = jest.fn(() => Promise.resolve({data: createdUser}));
        renderWithContext(
            <CreateUserModal
                {...baseProps}
                actions={{createUser}}
            />,
        );

        await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
        await userEvent.type(screen.getByLabelText('Username'), 'newuser');
        await userEvent.type(screen.getByLabelText('Password'), 'password');
        await userEvent.click(screen.getByRole('button', {name: /Create user/i}));

        expect(createUser).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
        });
    });

    test('should not create the user when username is invalid', async () => {
        const createUser = jest.fn(() => Promise.resolve({data: createdUser}));
        renderWithContext(
            <CreateUserModal
                {...baseProps}
                actions={{createUser}}
            />,
        );

        await userEvent.type(screen.getByLabelText('Email'), 'user@test.com');
        await userEvent.type(screen.getByLabelText('Username'), '1invalid');
        await userEvent.type(screen.getByLabelText('Password'), 'password');
        await userEvent.click(screen.getByRole('button', {name: /Create user/i}));

        expect(createUser).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText(/Usernames have to begin with a lowercase letter/i)).toBeInTheDocument();
        });
    });

    test('should create the user and navigate to the detail page on success', async () => {
        historyMock.push.mockClear();
        const createUser = jest.fn(() => Promise.resolve({data: createdUser}));

        renderWithContext(
            <CreateUserModal
                {...baseProps}
                actions={{createUser}}
            />,
        );

        await userEvent.type(screen.getByLabelText('Email'), 'New.User@Test.com');
        await userEvent.type(screen.getByLabelText('Username'), 'newuser');
        await userEvent.type(screen.getByLabelText('Password'), 'password');
        await userEvent.click(screen.getByRole('button', {name: /Create user/i}));

        await waitFor(() => {
            expect(createUser).toHaveBeenCalledTimes(1);
            expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
                email: 'new.user@test.com',
                username: 'newuser',
                password: 'password',
            }), '', '', '');
            expect(historyMock.push).toHaveBeenCalledWith('/admin_console/user_management/user/new_user_id');
        });
    });

    test('should display a server error inline when create fails', async () => {
        const createUser = jest.fn(() => Promise.resolve({error: {message: 'Something went wrong', server_error_id: 'some.error'}}));
        renderWithContext(
            <CreateUserModal
                {...baseProps}
                actions={{createUser}}
            />,
        );

        await userEvent.type(screen.getByLabelText('Email'), 'user@test.com');
        await userEvent.type(screen.getByLabelText('Username'), 'newuser');
        await userEvent.type(screen.getByLabelText('Password'), 'password');
        await userEvent.click(screen.getByRole('button', {name: /Create user/i}));

        await waitFor(() => {
            expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
        });
    });
});
