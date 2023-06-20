// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ReplyIcon from 'components/widgets/icons/reply_icon';

import Button from './button';

describe('components/threading/common/button', () => {
    test('should support onClick', () => {
        const action = jest.fn();

        const wrapper = shallow<typeof Button>(
            <Button
                onClick={action}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        wrapper.simulate('click');
        expect(action).toHaveBeenCalled();
    });

    test('should support className', () => {
        const className = 'test-class other-test-class';
        const wrapper = shallow<typeof Button>(
            <Button
                className={className}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.hasClass('test-class')).toBe(true);
        expect(wrapper.hasClass('other-test-class')).toBe(true);
    });

    test('should support prepended content', () => {
        const wrapper = shallow<typeof Button>(
            <Button
                prepend={<ReplyIcon className='Icon'/>}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.exists('.Button_prepended ReplyIcon')).toBe(true);
    });

    test('should support appended content', () => {
        const wrapper = shallow<typeof Button>(
            <Button
                append={<ReplyIcon className='Icon'/>}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.exists('.Button_appended ReplyIcon')).toBe(true);
    });

    test('should support children', () => {
        const wrapper = shallow<typeof Button>(
            <Button>
                {'text-goes-here'}
            </Button>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.text()).toBe('text-goes-here');
    });
});
