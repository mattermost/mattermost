// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import RadioSetting from './radio_setting';

describe('components/widgets/settings/RadioSetting', () => {
    test('should render component with required props', () => {
        const onChange = jest.fn();
        render(
            <RadioSetting
                id='string.id'
                label='some label'
                options={[
                    {text: 'this is engineering', value: 'Engineering'},
                    {text: 'this is sales', value: 'Sales'},
                    {text: 'this is administration', value: 'Administration'},
                ]}
                value={'Sales'}
                onChange={onChange}
            />,
        );

        expect(screen.getByText('some label')).toBeInTheDocument();

        const engineeringRadio = screen.getByRole('radio', {name: 'this is engineering'});
        expect(engineeringRadio).toBeInTheDocument();
        expect(engineeringRadio).not.toBeChecked();
        expect(engineeringRadio).toHaveAttribute('value', 'Engineering');

        const salesRadio = screen.getByRole('radio', {name: 'this is sales'});
        expect(salesRadio).toBeInTheDocument();
        expect(salesRadio).toBeChecked();
        expect(salesRadio).toHaveAttribute('value', 'Sales');

        const adminRadio = screen.getByRole('radio', {name: 'this is administration'});
        expect(adminRadio).toBeInTheDocument();
        expect(adminRadio).not.toBeChecked();
        expect(adminRadio).toHaveAttribute('value', 'Administration');

        // All should have the same name attribute
        expect(engineeringRadio).toHaveAttribute('name', 'string.id');
        expect(salesRadio).toHaveAttribute('name', 'string.id');
        expect(adminRadio).toHaveAttribute('name', 'string.id');
    });

    test('should call onChange when radio option is clicked', async () => {
        const onChange = jest.fn();
        render(
            <RadioSetting
                id='string.id'
                label='some label'
                options={[
                    {text: 'this is engineering', value: 'Engineering'},
                    {text: 'this is sales', value: 'Sales'},
                    {text: 'this is administration', value: 'Administration'},
                ]}
                value={'Sales'}
                onChange={onChange}
            />,
        );

        const adminRadio = screen.getByRole('radio', {name: 'this is administration'});
        await userEvent.click(adminRadio);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', 'Administration');
    });
});
