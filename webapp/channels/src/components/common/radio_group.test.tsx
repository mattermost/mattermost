// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import RadioButtonGroup from 'components/common/radio_group';

describe('/components/common/RadioButtonGroup', () => {
    const onChange = jest.fn();
    const baseProps = {
        id: 'test-string',
        value: 'value2',
        values: [{key: 'key1', value: 'value1'}, {key: 'key2', value: 'value2'}, {key: 'key3', value: 'value3'}],
        onChange,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<RadioButtonGroup {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('test radio button group input lenght is as expected', () => {
        const wrapper = shallow(<RadioButtonGroup {...baseProps}/>);
        const buttons = wrapper.find('input');

        expect(buttons.length).toBe(3);
    });

    test('test radio button group onChange function', () => {
        const wrapper = shallow(<RadioButtonGroup {...baseProps}/>);

        const buttons = wrapper.find('input');
        buttons.at(0).simulate('change');

        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
