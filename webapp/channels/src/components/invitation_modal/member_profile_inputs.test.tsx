// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MemberProfileInputs from './member_profile_inputs';

describe('MemberProfileInputs', () => {
    const baseProps = {
        usersEmails: ['dave.roberts@gmail.com'],
        profiles: {},
        onProfileChange: jest.fn(),
    };

    test('renders a row per plain email entry', () => {
        renderWithContext(
            <MemberProfileInputs
                {...baseProps}
                usersEmails={['one@example.com', 'two@example.com']}
            />,
        );
        expect(screen.getByTestId('MemberProfileInputs__row-one@example.com')).toBeInTheDocument();
        expect(screen.getByTestId('MemberProfileInputs__row-two@example.com')).toBeInTheDocument();
    });

    test('skips existing users and non-email entries', () => {
        const existingUser: UserProfile = TestHelper.getUserMock({username: 'existing'});
        const {container} = renderWithContext(
            <MemberProfileInputs
                {...baseProps}
                usersEmails={[existingUser, 'not-an-email', 'one@example.com']}
            />,
        );
        expect(container.querySelectorAll('.MemberProfileInputs__row')).toHaveLength(1);
    });

    test('renders nothing without any plain email entries', () => {
        const {container} = renderWithContext(
            <MemberProfileInputs
                {...baseProps}
                usersEmails={[TestHelper.getUserMock({username: 'existing'})]}
            />,
        );
        expect(container.querySelector('.MemberProfileInputs')).toBeNull();
    });

    test('shows the stored profile values', () => {
        renderWithContext(
            <MemberProfileInputs
                {...baseProps}
                profiles={{
                    'dave.roberts@gmail.com': {
                        email: 'dave.roberts@gmail.com',
                        username: 'dave.roberts',
                        first_name: 'Dave',
                        last_name: 'Roberts',
                    },
                }}
            />,
        );
        expect(screen.getByDisplayValue('Dave')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Roberts')).toBeInTheDocument();
        expect(screen.getByDisplayValue('dave.roberts')).toBeInTheDocument();
    });

    test('reports edits through onProfileChange', async () => {
        const onProfileChange = jest.fn();
        renderWithContext(
            <MemberProfileInputs
                {...baseProps}
                onProfileChange={onProfileChange}
            />,
        );

        await userEvent.type(screen.getAllByPlaceholderText('First name')[0], 'D');
        expect(onProfileChange).toHaveBeenCalledWith({
            email: 'dave.roberts@gmail.com',
            username: '',
            first_name: 'D',
            last_name: '',
        });
    });

    test('does not show a username error while typing', async () => {
        const onProfileChange = jest.fn();
        renderWithContext(
            <MemberProfileInputs
                {...baseProps}
                onProfileChange={onProfileChange}
            />,
        );

        await userEvent.type(screen.getByPlaceholderText('Username'), 'a');
        expect(screen.queryByText(/Usernames have to begin with a lowercase letter/)).not.toBeInTheDocument();
    });

    test('normalizes a mixed-case username on blur', async () => {
        const onProfileChange = jest.fn();
        renderWithContext(
            <MemberProfileInputs
                {...baseProps}
                onProfileChange={onProfileChange}
                profiles={{
                    'dave.roberts@gmail.com': {
                        email: 'dave.roberts@gmail.com',
                        username: 'Dave.Roberts',
                        first_name: 'Dave',
                        last_name: 'Roberts',
                    },
                }}
            />,
        );

        await userEvent.click(screen.getByPlaceholderText('Username'));
        await userEvent.tab();

        expect(onProfileChange).toHaveBeenCalledWith({
            email: 'dave.roberts@gmail.com',
            username: 'dave.roberts',
            first_name: 'Dave',
            last_name: 'Roberts',
        });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('shows a full-width username error after blur', async () => {
        const onProfileChange = jest.fn();
        renderWithContext(
            <MemberProfileInputs
                {...baseProps}
                onProfileChange={onProfileChange}
                profiles={{
                    'dave.roberts@gmail.com': {
                        email: 'dave.roberts@gmail.com',
                        username: 'inv@lid',
                        first_name: '',
                        last_name: '',
                    },
                }}
            />,
        );

        const usernameInput = screen.getByPlaceholderText('Username');
        expect(screen.queryByText(/Usernames have to begin with a lowercase letter/)).not.toBeInTheDocument();

        await userEvent.click(usernameInput);
        await userEvent.tab();

        const error = screen.getByRole('alert');
        expect(error).toHaveTextContent(/Usernames have to begin with a lowercase letter/);
        expect(error).toHaveClass('MemberProfileInputs__error');
        expect(error.parentElement).toHaveClass('MemberProfileInputs__row');
    });
});
