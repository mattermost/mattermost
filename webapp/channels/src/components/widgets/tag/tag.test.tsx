// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';
import {shallow} from 'enzyme';
import React from 'react';

import Tag from './tag';

const classNameProp = 'Tag Tag--xs test';

describe('components/widgets/tag/Tag', () => {
    test('should match the snapshot on show', () => {
        const wrapper = shallow(
            <Tag
                className={'test'}
                text={'Test text'}
            />,
        );
        expect(wrapper.props()).toEqual(expect.objectContaining({className: classNameProp}));
        expect(wrapper.text()).toEqual('Test text');
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
        expect(wrapper.props()).toEqual(expect.objectContaining({className: classNameProp}));
        expect(wrapper.find(AlertCircleOutlineIcon).exists()).toEqual(true);
        expect(wrapper.text()).toContain('Test text');
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
        expect(wrapper.props()).toEqual(expect.objectContaining({className: classNameProp, uppercase: true}));
        expect(wrapper.text()).toEqual('Test text');
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
        expect(wrapper.props()).toEqual(expect.objectContaining({className: 'Tag Tag--sm test'}));
        expect(wrapper.text()).toEqual('Test text');
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
        expect(wrapper.props()).toEqual(expect.objectContaining({className: 'Tag Tag--success Tag--xs test'}));
        expect(wrapper.text()).toEqual('Test text');
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
        expect(wrapper.props()).toEqual(expect.objectContaining({className: classNameProp, onClick: click}));
        expect(wrapper.text()).toEqual('Test text');
        wrapper.simulate('click');
        expect(click).toBeCalled();
        expect(wrapper).toMatchSnapshot();
    });
});
