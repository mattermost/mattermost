// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MemberInviteProfile} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {TestHelper} from 'utils/test_helper';

import {
    canPresetMemberInviteProfiles,
    filterProfilesForEmails,
    getEmailsToPreset,
    getProfileForEmail,
    profileHasInput,
    setProfileForEmail,
    suggestMemberInviteProfile,
} from './member_invite_profiles';

describe('member_invite_profiles', () => {
    test('suggests names and a username from a first.last address and normalizes case', () => {
        expect(suggestMemberInviteProfile('Dave.ROBERTS@Gmail.com')).toEqual({
            email: 'dave.roberts@gmail.com',
            username: 'dave.roberts',
            first_name: 'Dave',
            last_name: 'Roberts',
        });
    });

    test('leaves personal, shorthand, and multi-part addresses empty', () => {
        expect(suggestMemberInviteProfile('djr1985@gmail.com')).toEqual({
            email: 'djr1985@gmail.com',
            username: '',
            first_name: '',
            last_name: '',
        });
        expect(suggestMemberInviteProfile('a.b.c@example.com').username).toBe('');
    });

    test('detects filled and empty profiles', () => {
        expect(profileHasInput(undefined)).toBe(false);
        expect(profileHasInput({email: 'a@b.c', username: '', first_name: '', last_name: ''})).toBe(false);
        expect(profileHasInput({email: 'a@b.c', username: 'user', first_name: '', last_name: ''})).toBe(true);
        expect(profileHasInput({email: 'a@b.c', username: '', first_name: 'First', last_name: ''})).toBe(true);
    });

    test('keeps only plain valid email entries', () => {
        const existingUser: UserProfile = TestHelper.getUserMock({username: 'existing'});
        expect(getEmailsToPreset([existingUser, 'not-an-email', 'one@example.com'])).toEqual(['one@example.com']);
    });

    test('enables preset profiles only when email invitations and profile locking are enabled', () => {
        expect(canPresetMemberInviteProfiles(true, 'name_and_username')).toBe(true);
        expect(canPresetMemberInviteProfiles(true, 'all')).toBe(true);
        expect(canPresetMemberInviteProfiles(true, 'none')).toBe(false);
        expect(canPresetMemberInviteProfiles(false, 'all')).toBe(false);
    });

    test('gets and immutably sets profiles using normalized email keys', () => {
        const profile: MemberInviteProfile = {
            email: 'User@Example.com',
            username: 'user',
            first_name: 'Test',
            last_name: 'User',
        };
        const originalProfiles = {};
        const profiles = setProfileForEmail(originalProfiles, profile.email, profile);

        expect(originalProfiles).toEqual({});
        expect(profiles).toEqual({
            'user@example.com': {
                ...profile,
                email: 'user@example.com',
            },
        });
        expect(getProfileForEmail(profiles, 'USER@EXAMPLE.COM')).toEqual(profiles['user@example.com']);
    });

    test('filters profiles to invited addresses with input using normalized lookups', () => {
        const profiles = {
            'filled@example.com': {
                email: 'filled@example.com',
                username: 'filled',
                first_name: 'Filled',
                last_name: 'Profile',
            },
            'empty@example.com': {
                email: 'empty@example.com',
                username: '',
                first_name: '',
                last_name: '',
            },
            'not-invited@example.com': {
                email: 'not-invited@example.com',
                username: 'other',
                first_name: '',
                last_name: '',
            },
        };

        expect(filterProfilesForEmails(profiles, ['FILLED@example.com', 'empty@example.com'])).toEqual([{
            email: 'filled@example.com',
            username: 'filled',
            first_name: 'Filled',
            last_name: 'Profile',
        }]);
        expect(filterProfilesForEmails(undefined, ['filled@example.com'])).toEqual([]);
    });
});
