// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {UserProfile} from '@mattermost/types/users';

import ManageFirstDayOfWeek from './manage_first_day_of_week';

describe('components/user_settings/display/manage_first_day_of_week/manage_first_day_of_week', () => {
    const user = {
        id: 'user_id',
    };

    const requiredProps = {
        firstDayOfWeek: 0,
        daysOfWeek: [],
        user: user as UserProfile,
        updateSection: jest.fn(),
        actions: {
            updateMe: jest.fn(() => Promise.resolve({})),
        },
    };

    test('submitUser() should have called [updateMe, updateSection]', async () => {
        const updateMe = jest.fn(() => Promise.resolve({data: true}));
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, updateMe},
            firstDayOfWeek: 2,
        };
        const wrapper = shallow(<ManageFirstDayOfWeek {...props} />);

        await (wrapper.instance() as ManageFirstDayOfWeek).submitUser();

        const expected = {
            ...props.user,
            props: {
                ...props.user.props,
                first_day_of_week: props.firstDayOfWeek.toString(),
            },
        };
        console.log('expected\n', expected);
        expect(props.actions.updateMe).toHaveBeenCalled();
        expect(props.actions.updateMe).toHaveBeenCalledWith(expected);

        expect(props.updateSection).toHaveBeenCalled();
        expect(props.updateSection).toHaveBeenCalledWith('');
    });
});
