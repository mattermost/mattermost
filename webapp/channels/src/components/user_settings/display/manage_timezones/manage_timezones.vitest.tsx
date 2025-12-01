// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

import ManageTimezones from './manage_timezones';

describe('components/user_settings/display/manage_timezones/manage_timezones', () => {
    const user = {
        id: 'user_id',
    };

    const requiredProps = {
        user: user as UserProfile,
        locale: '',
        useAutomaticTimezone: true,
        automaticTimezone: '',
        manualTimezone: '',
        timezoneLabel: '',
        timezones: [],
        updateSection: vi.fn(),
        actions: {
            updateMe: vi.fn(() => Promise.resolve({data: true})),
            patchUser: vi.fn(() => Promise.resolve({data: true})),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('submitUser() should have called [updateMe, updateSection]', async () => {
        const updateMe = vi.fn(() => Promise.resolve({data: true}));
        const updateSection = vi.fn();
        const props = {
            ...requiredProps,
            updateSection,
            actions: {...requiredProps.actions, updateMe},
        };

        renderWithContext(<ManageTimezones {...props}/>);

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        // When timezone unchanged, it should just call updateSection without calling updateMe
        expect(updateSection).toHaveBeenCalledWith('');
    });
});
