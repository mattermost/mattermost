// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ManageTimezones from './manage_timezones';

jest.mock('utils/timezone', () => ({
    getBrowserTimezone: jest.fn(() => 'America/New_York'),
}));

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
        updateSection: jest.fn(),
        actions: {
            updateMe: jest.fn(() => Promise.resolve({})),
            patchUser: jest.fn(() => Promise.resolve({})),
        },
    };

    test('submitUser() should have called [updateMe, updateSection]', async () => {
        const updateMe = jest.fn(() => Promise.resolve({data: true}));
        const updateSection = jest.fn();
        const props = {
            ...requiredProps,
            updateSection,
            useAutomaticTimezone: false,
            automaticTimezone: 'Europe/London',
            manualTimezone: 'Europe/London',
            timezones: [{
                value: 'GMT Standard Time',
                abbr: 'GMT',
                offset: 0,
                isdst: false,
                text: '(UTC) London',
                utc: ['Europe/London'],
            }],
            actions: {...requiredProps.actions, updateMe},
        };
        renderWithContext(<ManageTimezones {...props}/>);

        // Toggle the automatic timezone checkbox to create a state diff
        await userEvent.click(screen.getByRole('checkbox', {name: /automatic/i}));

        // Click Save to trigger changeTimezone → submitUser
        await userEvent.click(screen.getByTestId('saveSetting'));

        const expected = {
            ...props.user,
            timezone: {
                useAutomaticTimezone: 'true',
                manualTimezone: 'Europe/London',
                automaticTimezone: 'America/New_York',
            },
        };

        expect(updateMe).toHaveBeenCalled();
        expect(updateMe).toHaveBeenCalledWith(expected);

        expect(updateSection).toHaveBeenCalled();
        expect(updateSection).toHaveBeenCalledWith('');
    });
});
