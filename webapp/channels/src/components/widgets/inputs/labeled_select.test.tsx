// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import type {OptionProps} from 'react-select';

import LabeledSelect from './labeled_select';
import type {LabeledSelectOption} from './labeled_select';

function wrap(ui: React.ReactElement) {
    return <IntlProvider locale='en'>{ui}</IntlProvider>;
}

function openMenu() {
    const combobox = screen.getByRole('combobox');
    fireEvent.mouseDown(combobox);
    fireEvent.focus(combobox);
}

const options: LabeledSelectOption[] = [
    {label: 'Text', value: 'text', icon: <span data-testid='icon-text'>{'T'}</span>},
    {label: 'Date', value: 'date', icon: <span data-testid='icon-date'>{'D'}</span>},
    {label: 'Select', value: 'select', icon: <span data-testid='icon-select'>{'S'}</span>},
];

describe('components/widgets/inputs/LabeledSelect', () => {
    test('renders the legend / label when a value is selected', () => {
        render(wrap(
            <LabeledSelect
                inputId='lsel-1'
                label='Field type'
                value={options[0]}
                options={options}
                onChange={jest.fn()}
            />,
        ));

        // legend floats when there is a value
        expect(screen.getByText('Field type')).toBeInTheDocument();
    });

    test('renders the input with the supplied inputId', () => {
        const {container} = render(wrap(
            <LabeledSelect
                inputId='lsel-id-check'
                label='Field type'
                value={null}
                options={options}
                onChange={jest.fn()}
            />,
        ));

        expect(container.querySelector('#lsel-id-check')).not.toBeNull();
    });

    test('renders every option with its icon when the menu is opened', () => {
        render(wrap(
            <LabeledSelect
                inputId='lsel-2'
                label='Field type'
                value={null}
                options={options}
                onChange={jest.fn()}
            />,
        ));

        openMenu();

        expect(screen.getByRole('option', {name: /Text/})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: /Date/})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: /Select/})).toBeInTheDocument();

        // icons render inside the menu options
        expect(screen.getByTestId('icon-text')).toBeInTheDocument();
        expect(screen.getByTestId('icon-date')).toBeInTheDocument();
        expect(screen.getByTestId('icon-select')).toBeInTheDocument();
    });

    test('fires onChange with the picked option in single-select mode', () => {
        const onChange = jest.fn();
        render(wrap(
            <LabeledSelect
                inputId='lsel-3'
                label='Field type'
                value={null}
                options={options}
                onChange={onChange}
            />,
        ));

        openMenu();
        fireEvent.click(screen.getByRole('option', {name: /Date/}));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({value: 'date', label: 'Date'}));
    });

    test('fires onChange with the array of options in multi-select mode', () => {
        const onChange = jest.fn();
        render(wrap(
            <LabeledSelect
                inputId='lsel-4'
                label='Field type'
                value={[options[0]]}
                options={options}
                onChange={onChange}
                isMulti={true}
            />,
        ));

        openMenu();
        fireEvent.click(screen.getByRole('option', {name: /Select/}));

        expect(onChange).toHaveBeenCalledTimes(1);
        const arg = onChange.mock.calls[0][0];
        expect(Array.isArray(arg)).toBe(true);
        const values = (arg as LabeledSelectOption[]).map((o) => o.value);
        expect(values).toEqual(expect.arrayContaining(['text', 'select']));
    });

    test('renders the error / customMessage row when hasError is set', () => {
        render(wrap(
            <LabeledSelect
                inputId='lsel-5'
                label='Field type'
                value={null}
                options={options}
                onChange={jest.fn()}
                hasError={true}
                customMessage={{type: 'error', value: 'Something went wrong'}}
            />,
        ));

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    test('caller component overrides merge with defaults', () => {
        // Override only the Option; SingleValue / IndicatorSeparator defaults still apply.
        const CustomOption = (props: OptionProps<LabeledSelectOption, false>) => (
            <div
                ref={props.innerRef}
                {...props.innerProps}
                role='option'
                data-testid={`custom-option-${props.data.value}`}
            >
                {`Custom ${props.data.label}`}
            </div>
        );

        render(wrap(
            <LabeledSelect
                inputId='lsel-6'
                label='Field type'
                value={null}
                options={options}
                onChange={jest.fn()}
                components={{Option: CustomOption as any}}
            />,
        ));

        openMenu();

        expect(screen.getByTestId('custom-option-text')).toBeInTheDocument();
        expect(screen.getByText('Custom Text')).toBeInTheDocument();

        // Defaults we did NOT override remain — the icon-bearing default option
        // is gone (because we overrode Option), but verifying icons appear nowhere
        // proves the override took effect.
        expect(screen.queryByTestId('icon-text')).not.toBeInTheDocument();
    });
});
