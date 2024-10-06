// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import UserProfile from './user_profile';

describe('components/UserProfile', () => {
    const baseProps = {
        displayName: 'nickname',
        isBusy: false,
        isMobileView: false,
        user: {username: 'username'} as UserProfileType,
        userId: 'user_id',
        theme: Preferences.THEMES.onyx,
        isShared: false,
        dispatch: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<UserProfile {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with colorization', () => {
        const props = {
            ...baseProps,
            colorize: true,
        };

        const wrapper = shallow(<UserProfile {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, when user is shared', () => {
        const props = {
            ...baseProps,
            isShared: true,
        };

        const wrapper = shallow(<UserProfile {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, when popover is disabled', () => {
        const wrapper = shallow(
            <UserProfile
                {...baseProps}
                disablePopover={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, when displayUsername is enabled', () => {
        const wrapper = shallow(
            <UserProfile
                {...baseProps}
                displayUsername={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
