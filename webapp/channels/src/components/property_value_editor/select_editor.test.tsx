// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import SelectEditor from './select_editor';

function wrap(ui: React.ReactElement) {
    return <IntlProvider locale='en'>{ui}</IntlProvider>;
}

function makeSelectField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Status',
        type: 'select',
        attrs: {
            options: [
                {id: 'opt1', name: 'Open'},
                {id: 'opt2', name: 'In Progress'},
                {id: 'opt3', name: 'Done'},
            ],
        },
        target_id: 'channel-1',
        target_type: 'channel',
        object_type: 'post',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'u1',
        updated_by: 'u1',
        ...overrides,
    };
}

describe('components/property_value_editor/SelectEditor (single)', () => {
    test('renders a select element with options from field attrs', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));

        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'Open'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'In Progress'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'Done'})).toBeInTheDocument();
    });

    test('shows blank option when value is empty', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));
        expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
    });

    test('selects the option matching the current value', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value='opt2'
                onChange={jest.fn()}
                multi={false}
            />,
        ));
        expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('opt2');
    });

    test('calls onChange with the option id when changed', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={onChange}
                multi={false}
            />,
        ));

        fireEvent.change(screen.getByRole('combobox'), {target: {value: 'opt1'}});
        expect(onChange).toHaveBeenCalledWith('opt1');
    });

    test('calls onChange with undefined when the blank option is chosen', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value='opt1'
                onChange={onChange}
                multi={false}
            />,
        ));

        fireEvent.change(screen.getByRole('combobox'), {target: {value: ''}});
        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    test('renders a placeholder when field has no options', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField({attrs: {options: []}})}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));
        expect(screen.getByText(/no options/i)).toBeInTheDocument();
    });
});

describe('components/property_value_editor/SelectEditor (multi)', () => {
    test('renders checkboxes for each option', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={[]}
                onChange={jest.fn()}
                multi={true}
            />,
        ));

        expect(screen.getByRole('checkbox', {name: 'Open'})).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'In Progress'})).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'Done'})).toBeInTheDocument();
    });

    test('pre-checks options whose ids are in the value array', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1', 'opt3']}
                onChange={jest.fn()}
                multi={true}
            />,
        ));

        expect(screen.getByRole('checkbox', {name: 'Open'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'In Progress'})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Done'})).toBeChecked();
    });

    test('adds an option id to the array when its checkbox is checked', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1']}
                onChange={onChange}
                multi={true}
            />,
        ));

        fireEvent.click(screen.getByRole('checkbox', {name: 'In Progress'}));
        expect(onChange).toHaveBeenCalledWith(['opt1', 'opt2']);
    });

    test('removes an option id from the array when its checkbox is unchecked', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1', 'opt2']}
                onChange={onChange}
                multi={true}
            />,
        ));

        fireEvent.click(screen.getByRole('checkbox', {name: 'Open'}));
        expect(onChange).toHaveBeenCalledWith(['opt2']);
    });
});
