// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ReplyIcon from 'components/widgets/icons/reply_icon';

import ThreadButton from './thread_button';

describe('components/threading/common/thread_button', () => {
    test('should support onClick', () => {
        const action = jest.fn();

        const wrapper = shallow<typeof ThreadButton>(
            <ThreadButton
                onClick={action}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        wrapper.simulate('click');
        expect(action).toHaveBeenCalled();
    });

    test('should support className', () => {
        const className = 'test-class other-test-class';
        const wrapper = shallow<typeof ThreadButton>(
            <ThreadButton
                className={className}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.hasClass('test-class')).toBe(true);
        expect(wrapper.hasClass('other-test-class')).toBe(true);
    });

    test('should support prepended content', () => {
        const wrapper = shallow<typeof ThreadButton>(
            <ThreadButton
                prepend={<ReplyIcon className='Icon'/>}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.exists('.ThreadButton_prepended ReplyIcon')).toBe(true);
    });

    test('should support appended content', () => {
        const wrapper = shallow<typeof ThreadButton>(
            <ThreadButton
                append={<ReplyIcon className='Icon'/>}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.exists('.ThreadButton_appended ReplyIcon')).toBe(true);
    });

    test('should support children', () => {
        const wrapper = shallow<typeof ThreadButton>(
            <ThreadButton>
                {'text-goes-here'}
            </ThreadButton>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.text()).toBe('text-goes-here');
    });
});
