// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LockProfileFieldsSetting} from '@mattermost/types/config';

import {createProfileFieldLockPolicy, type ProfileField, type ProfileFieldLockState} from './profile_field_lock_policy';

describe('createProfileFieldLockPolicy', () => {
    const fields: ProfileField[] = ['firstName', 'lastName', 'username', 'nickname', 'position', 'picture'];

    test.each<{
        name: string;
        setting: LockProfileFieldsSetting;
        authService?: string;
        canEditOtherUsers?: boolean;
        firstName?: string;
        lastName?: string;
        expected: ProfileFieldLockState[];
    }>([
        {name: 'none', setting: 'none', expected: ['editable', 'editable', 'editable', 'editable', 'editable', 'editable']},
        {name: 'name and username', setting: 'name_and_username', expected: ['locked', 'locked', 'locked', 'editable', 'editable', 'editable']},
        {name: 'all', setting: 'all', expected: ['locked', 'locked', 'locked', 'locked', 'locked', 'locked']},
        {name: 'fill first name once', setting: 'all', firstName: '', expected: ['fill_once', 'locked', 'locked', 'locked', 'locked', 'locked']},
        {name: 'fill last name once', setting: 'all', lastName: '', expected: ['locked', 'fill_once', 'locked', 'locked', 'locked', 'locked']},
        {name: 'login provider exemption', setting: 'all', authService: 'ldap', expected: ['editable', 'editable', 'editable', 'editable', 'editable', 'editable']},
        {name: 'edit other users exemption', setting: 'all', canEditOtherUsers: true, expected: ['editable', 'editable', 'editable', 'editable', 'editable', 'editable']},
    ])('$name', ({setting, authService = '', canEditOtherUsers = false, firstName = 'First', lastName = 'Last', expected}) => {
        const policy = createProfileFieldLockPolicy({
            user: {
                auth_service: authService,
                first_name: firstName,
                last_name: lastName,
            },
            canEditOtherUsers,
            lockProfileFieldsForEmailUsers: setting,
        });

        expect(Object.values(policy.fields)).toEqual(expected);
        expect(fields.map(policy.isLocked)).toEqual(expected.map((state) => state === 'locked'));
        expect(policy.allNameFieldsLocked).toBe(expected[0] === 'locked' && expected[1] === 'locked');
        expect(policy.hasLockedNameField).toBe(expected[0] === 'locked' || expected[1] === 'locked');
    });
});
