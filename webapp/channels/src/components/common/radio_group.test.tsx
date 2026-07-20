// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import RadioButtonGroup from 'components/common/radio_group';

import {render, screen, userEvent} from 'tests/react_testing_utils';

describe('/components/common/RadioButtonGroup', () => {
    const onChange = jest.fn();
    const baseProps = {
        id: 'test-string',
        value: 'value2',
        values: [{key: 'key1', value: 'value1'}, {key: 'key2', value: 'value2'}, {key: 'key3', value: 'value3'}],
        onChange,
    };

    test('should match snapshot', () => {
        const {container} = render(<RadioButtonGroup {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('test radio button group input lenght is as expected', () => {
        render(<RadioButtonGroup {...baseProps}/>);
        const buttons = screen.getAllByRole('radio');

        expect(buttons.length).toBe(3);
    });

    test('test radio button group onChange function', async () => {
        render(<RadioButtonGroup {...baseProps}/>);

        const buttons = screen.getAllByRole('radio');
        await userEvent.click(buttons[0]);

        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
