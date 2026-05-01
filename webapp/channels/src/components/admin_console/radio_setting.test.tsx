// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import RadioSetting from './radio_setting';

describe('components/admin_console/RadioSetting', () => {
    test('should match snapshot', () => {
        const onChange = jest.fn();
        const {container} = render(
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

    test('onChange', async () => {
        const onChange = jest.fn();
        render(
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

        const radios = screen.getAllByRole('radio');
        await userEvent.click(radios[2]);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 'Administration');
    });
});
