// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MemberProfileInputs, {
    getEmailsToPreset,
    profileHasInput,
    suggestMemberInviteProfile,
} from './member_profile_inputs';

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

    test('shows an error for an invalid username', () => {
        renderWithContext(
            <MemberProfileInputs
                {...baseProps}
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
        expect(screen.getByText(/Usernames have to begin with a lowercase letter/)).toBeInTheDocument();
    });
});

describe('suggestMemberInviteProfile', () => {
    test('derives names and username from a first.last local-part', () => {
        expect(suggestMemberInviteProfile('dave.roberts@gmail.com')).toEqual({
            email: 'dave.roberts@gmail.com',
            username: 'dave.roberts',
            first_name: 'Dave',
            last_name: 'Roberts',
        });
    });

    test('normalizes case', () => {
        expect(suggestMemberInviteProfile('Dave.ROBERTS@Gmail.com')).toEqual({
            email: 'dave.roberts@gmail.com',
            username: 'dave.roberts',
            first_name: 'Dave',
            last_name: 'Roberts',
        });
    });

    test('leaves personal or shorthand addresses empty', () => {
        expect(suggestMemberInviteProfile('djr1985@gmail.com')).toEqual({
            email: 'djr1985@gmail.com',
            username: '',
            first_name: '',
            last_name: '',
        });
        expect(suggestMemberInviteProfile('a.b.c@example.com').username).toBe('');
    });
});

describe('profileHasInput', () => {
    test('detects filled and empty profiles', () => {
        expect(profileHasInput(undefined)).toBe(false);
        expect(profileHasInput({email: 'a@b.c', username: '', first_name: '', last_name: ''})).toBe(false);
        expect(profileHasInput({email: 'a@b.c', username: 'user', first_name: '', last_name: ''})).toBe(true);
        expect(profileHasInput({email: 'a@b.c', username: '', first_name: 'First', last_name: ''})).toBe(true);
    });
});

describe('getEmailsToPreset', () => {
    test('keeps only plain valid email entries', () => {
        const existingUser: UserProfile = TestHelper.getUserMock({username: 'existing'});
        expect(getEmailsToPreset([existingUser, 'not-an-email', 'one@example.com'])).toEqual(['one@example.com']);
    });
});
