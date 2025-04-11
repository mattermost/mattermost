// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import ManageTimezones from './manage_timezones';
import type {ManageTimezones as ManageTimezonesClass} from './manage_timezones';

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
        const props = {...requiredProps, actions: {...requiredProps.actions, updateMe}};
        const wrapper = shallowWithIntl(<ManageTimezones {...props}/>);

        await (wrapper.instance() as ManageTimezonesClass).submitUser();

        const expected = {...props.user,
            timezone: {
                useAutomaticTimezone: props.useAutomaticTimezone.toString(),
                manualTimezone: props.manualTimezone,
                automaticTimezone: props.automaticTimezone,
            }};

        expect(props.actions.updateMe).toHaveBeenCalled();
        expect(props.actions.updateMe).toHaveBeenCalledWith(expected);

        expect(props.updateSection).toHaveBeenCalled();
        expect(props.updateSection).toHaveBeenCalledWith('');
    });
});
