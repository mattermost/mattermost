// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import UnreadChannelIndicator from './unread_channel_indicator';

describe('UnreadChannelIndicator', () => {
    const baseProps = {
        onClick: jest.fn(),
        show: true,
    };

    test('should match snapshot', () => {
        const props = {
            ...baseProps,
            show: false,
        };

        const wrapper = shallow(
            <UnreadChannelIndicator {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when show is set', () => {
        const wrapper = shallow(
            <UnreadChannelIndicator {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when content is text', () => {
        const props = {
            ...baseProps,
            content: 'foo',
        };

        const wrapper = shallow(
            <UnreadChannelIndicator {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when content is an element', () => {
        const props = {
            ...baseProps,
            content: <div>{'foo'}</div>,
        };

        const wrapper = shallow(
            <UnreadChannelIndicator {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have called onClick', () => {
        const props = {
            ...baseProps,
            content: <div>{'foo'}</div>,
            name: 'name',
        };

        const wrapper = shallow(
            <UnreadChannelIndicator {...props}/>,
        );

        wrapper.simulate('click');
        expect(props.onClick).toHaveBeenCalledTimes(1);
    });
});
