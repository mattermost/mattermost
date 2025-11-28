// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import RadioSetting from './radio_setting';

describe('components/admin_console/RadioSetting', () => {
    test('should match snapshot', () => {
        const onChange = vi.fn();
        const {container} = renderWithContext(
            <RadioSetting
                id='string.id'
                label='some label'
                values={[
                    {text: 'this is engineering', value: 'Engineering'},
                    {text: 'this is sales', value: 'Sales'},
                    {text: 'this is administration', value: 'Administration'},
                ]}
                value={'Sales'}
                onChange={onChange}
                setByEnv={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('onChange', () => {
        const onChange = vi.fn();
        const {container} = renderWithContext(
            <RadioSetting
                id='string.id'
                label='some label'
                values={[
                    {text: 'this is engineering', value: 'Engineering'},
                    {text: 'this is sales', value: 'Sales'},
                    {text: 'this is administration', value: 'Administration'},
                ]}
                value={'Sales'}
                onChange={onChange}
                setByEnv={false}
            />,
        );
        const inputs = container.querySelectorAll('input');

        // Click the first radio button (Engineering)
        fireEvent.click(inputs[0]);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 'Engineering');
    });
});
