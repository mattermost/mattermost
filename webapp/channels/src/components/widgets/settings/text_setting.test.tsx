// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import TextSetting from './text_setting';

describe('components/widgets/settings/TextSetting', () => {
    test('render component with required props', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <TextSetting
                id='string.id'
                label='some label'
                value='some value'
                onChange={onChange}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('render with textarea type', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <TextSetting
                id='string.id'
                label='some label'
                value='some value'
                type='textarea'
                onChange={onChange}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('onChange', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <TextSetting
                id='string.id'
                label='some label'
                value='some value'
                onChange={onChange}
            />,
        );

        wrapper.find('input').simulate('change', {target: {value: 'somenewvalue'}});

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 'somenewvalue');
    });
});
