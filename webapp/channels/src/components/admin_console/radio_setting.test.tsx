// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RadioSetting from './radio_setting';

describe('components/admin_console/RadioSetting', () => {
    const baseProps = {
        id: 'string.id',
        label: 'some label',
        values: [
            {text: 'this is engineering', value: 'Engineering'},
            {text: 'this is sales', value: 'Sales'},
            {text: 'this is administration', value: 'Administration'},
        ],
        value: 'Sales',
        onChange: jest.fn(),
        setByEnv: false,
    };

    test('should match snapshot', () => {
        const {container} = render(<RadioSetting {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('onChange handler is called when radio button is changed', () => {
        render(<RadioSetting {...baseProps}/>);
        
        // Find the first radio button (engineering) by its label text
        const engineeringRadio = screen.getByLabelText('this is engineering');
        
        // Click the radio button
        userEvent.click(engineeringRadio);

        // Verify the onChange handler was called with correct parameters
        expect(baseProps.onChange).toHaveBeenCalledTimes(1);
        expect(baseProps.onChange).toHaveBeenCalledWith('string.id', 'Engineering');
    });
});
