// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import Tag from './tag';

describe('components/primitives/tag/Tag', () => {
    test('should match the snapshot on show', () => {
        const wrapper = shallow(
            <Tag
                className={'test'}
                text={'Test text'}
            />,
        );
        expect(wrapper.hasClass('Tag')).toBe(true);
        expect(wrapper.hasClass('Tag--xs')).toBe(true);
        expect(wrapper.hasClass('Tag--lowercase')).toBe(true);
        expect(wrapper.hasClass('test')).toBe(true);
        expect(wrapper.find('.Tag__text').text()).toEqual('Test text');
        expect(wrapper).toMatchSnapshot();
    });

    test('should match the snapshot with icon', () => {
        const wrapper = shallow(
            <Tag
                className={'test'}
                text={'Test text'}
                icon={'alert-circle-outline'}
            />,
        );
        expect(wrapper.hasClass('Tag')).toBe(true);
        expect(wrapper.find('.Tag__icon').exists()).toBe(true);
        expect(wrapper.find(AlertCircleOutlineIcon).exists()).toEqual(true);
        expect(wrapper.find('.Tag__text').text()).toEqual('Test text');
        expect(wrapper).toMatchSnapshot();
    });

    test('should match the snapshot with uppercase prop', () => {
        const wrapper = shallow(
            <Tag
                className={'test'}
                text={'Test text'}
                uppercase={true}
            />,
        );
        expect(wrapper.hasClass('Tag')).toBe(true);
        expect(wrapper.hasClass('Tag--uppercase')).toBe(true);
        expect(wrapper.find('.Tag__text').text()).toEqual('Test text');
        expect(wrapper).toMatchSnapshot();
    });

    test('should match the snapshot with size "sm"', () => {
        const wrapper = shallow(
            <Tag
                className={'test'}
                text={'Test text'}
                size={'sm'}
            />,
        );
        expect(wrapper.hasClass('Tag')).toBe(true);
        expect(wrapper.hasClass('Tag--sm')).toBe(true);
        expect(wrapper.find('.Tag__text').text()).toEqual('Test text');
        expect(wrapper).toMatchSnapshot();
    });

    test('should match the snapshot with "success" variant', () => {
        const wrapper = shallow(
            <Tag
                className={'test'}
                text={'Test text'}
                variant={'success'}
            />,
        );
        expect(wrapper.hasClass('Tag')).toBe(true);
        expect(wrapper.hasClass('Tag--success')).toBe(true);
        expect(wrapper.find('.Tag__text').text()).toEqual('Test text');
        expect(wrapper).toMatchSnapshot();
    });

    test('should transform into a button if onClick provided', () => {
        const click = jest.fn();
        const wrapper = shallow(
            <Tag
                className={'test'}
                text={'Test text'}
                onClick={click}
            />,
        );
        expect(wrapper.type()).toBe('button');
        expect(wrapper.hasClass('Tag')).toBe(true);
        expect(wrapper.hasClass('Tag--clickable')).toBe(true);
        expect(wrapper.find('.Tag__text').text()).toEqual('Test text');
        wrapper.simulate('click');
        expect(click).toBeCalled();
        expect(wrapper).toMatchSnapshot();
    });
});

