// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import CheckboxGroupSetting from './checkbox_group_setting';

describe('components/widgets/settings/CheckboxGroupSetting', () => {
    const options = [
        {text: 'Reason 1', value: 'r1'},
        {text: 'Reason 2', value: 'r2'},
        {text: 'Reason 3', value: 'r3'},
    ];

    test('should render checkboxes reflecting the current value', () => {
        render(
            <CheckboxGroupSetting
                id='reasons'
                label='Reasons'
                options={options}
                value={['r2']}
                onChange={jest.fn()}
            />,
        );

        // Label renders both as the Setting label and the hidden fieldset legend.
        expect(screen.getAllByText('Reasons').length).toBeGreaterThan(0);
        expect(screen.getByRole('checkbox', {name: 'Reason 1'})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Reason 2'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Reason 3'})).not.toBeChecked();
    });

    test('checking an option adds it to the selection', async () => {
        const onChange = jest.fn();
        render(
            <CheckboxGroupSetting
                id='reasons'
                label='Reasons'
                options={options}
                value={['r2']}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('checkbox', {name: 'Reason 1'}));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('reasons', ['r2', 'r1']);
    });

    test('unchecking an option removes it from the selection', async () => {
        const onChange = jest.fn();
        render(
            <CheckboxGroupSetting
                id='reasons'
                label='Reasons'
                options={options}
                value={['r1', 'r2']}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('checkbox', {name: 'Reason 1'}));

        expect(onChange).toHaveBeenCalledWith('reasons', ['r2']);
    });

    test('unchecking the last option yields an empty selection', async () => {
        const onChange = jest.fn();
        render(
            <CheckboxGroupSetting
                id='reasons'
                label='Reasons'
                options={options}
                value={['r1']}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('checkbox', {name: 'Reason 1'}));

        expect(onChange).toHaveBeenCalledWith('reasons', []);
    });

    test('handles an undefined value by treating it as an empty selection', async () => {
        const onChange = jest.fn();
        render(
            <CheckboxGroupSetting
                id='reasons'
                label='Reasons'
                options={options}
                onChange={onChange}
            />,
        );

        expect(screen.getByRole('checkbox', {name: 'Reason 1'})).not.toBeChecked();

        await userEvent.click(screen.getByRole('checkbox', {name: 'Reason 2'}));
        expect(onChange).toHaveBeenCalledWith('reasons', ['r2']);
    });

    test('labelPosition "after" does not apply label-before styling', () => {
        const {container} = render(
            <CheckboxGroupSetting
                id='reasons'
                label='Reasons'
                options={[{text: 'Reason 1', value: 'r1'}]}
                labelPosition='after'
                onChange={jest.fn()}
            />,
        );

        const checkbox = container.querySelector('.checkbox label')!;
        expect(checkbox).not.toHaveClass('inline-choice-setting--label-before');
    });

    test('labelPosition "before" applies label-before styling', () => {
        const {container} = render(
            <CheckboxGroupSetting
                id='reasons'
                label='Reasons'
                options={[{text: 'Reason 1', value: 'r1'}]}
                labelPosition='before'
                onChange={jest.fn()}
            />,
        );

        const checkbox = container.querySelector('.checkbox label')!;
        expect(checkbox).toHaveClass('inline-choice-setting--label-before');
    });
});
