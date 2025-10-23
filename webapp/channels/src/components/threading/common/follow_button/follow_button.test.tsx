// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import FollowButton from './follow_button';

import ThreadButton from '../thread_button';

describe('components/threading/common/follow_button', () => {
    test('should say follow', () => {
        const clickHandler = jest.fn();

        const wrapper = mountWithIntl(
            <FollowButton
                isFollowing={false}
                onClick={clickHandler}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find(ThreadButton).text()).toBe('Follow');

        wrapper.find(ThreadButton).simulate('click');
        expect(clickHandler).toHaveBeenCalled();
    });

    test('should say following', () => {
        const wrapper = mountWithIntl(
            <FollowButton
                isFollowing={true}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find(ThreadButton).text()).toBe('Following');
    });

    test('should fire click handler', () => {
        const clickHandler = jest.fn();

        const wrapper = mountWithIntl(
            <FollowButton
                isFollowing={false}
                onClick={clickHandler}
            />,
        );

        wrapper.find(ThreadButton).simulate('click');
        expect(clickHandler).toHaveBeenCalled();
    });
});
