// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import RadioButtonGroup from 'components/radio_group';

import {renderWithContext} from 'tests/react_testing_utils';

describe('/components/RadioButtonGroup', () => {
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
        const wrapper = renderWithContext(<RadioButtonGroup {...baseProps}/>);
        const buttons = wrapper.queryAllByTestId('test-string');

        expect(buttons.length).toBe(3);
    });

    test('test radio button group onChange function', () => {
        const wrapper = renderWithContext(<RadioButtonGroup {...baseProps}/>);

        const buttons = wrapper.queryAllByTestId('test-string');
        buttons[0].click();

        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
