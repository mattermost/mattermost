// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import RadioButtonGroup from 'components/common/radio_group';

describe('/components/common/RadioButtonGroup', () => {
    const onChange = vi.fn();
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

    test('test radio button group input length is as expected', () => {
        render(<RadioButtonGroup {...baseProps}/>);
        const buttons = screen.getAllByRole('radio');

        expect(buttons.length).toBe(3);
    });

    test('test radio button group onChange function', () => {
        render(<RadioButtonGroup {...baseProps}/>);

        const buttons = screen.getAllByRole('radio');
        fireEvent.click(buttons[0]);

        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
