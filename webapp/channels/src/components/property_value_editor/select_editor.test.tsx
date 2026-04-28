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

function openMenu() {
    const combobox = screen.getByRole('combobox');
    fireEvent.mouseDown(combobox);
    fireEvent.focus(combobox);
}

describe('components/property_value_editor/SelectEditor (single)', () => {
    test('renders a combobox', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));

        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('shows the option matching the current value', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value='opt2'
                onChange={jest.fn()}
                multi={false}
            />,
        ));
        expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    test('renders all options in the menu when opened', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));

        openMenu();

        expect(screen.getByRole('option', {name: 'Open'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'In Progress'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'Done'})).toBeInTheDocument();
    });

    test('calls onChange with the option id when an option is selected', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={onChange}
                multi={false}
            />,
        ));

        openMenu();
        fireEvent.click(screen.getByRole('option', {name: 'Open'}));

        expect(onChange).toHaveBeenCalledWith('opt1');
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
    test('renders a combobox with multi selection', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={[]}
                onChange={jest.fn()}
                multi={true}
            />,
        ));

        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('shows pills for the option ids in the value array', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1', 'opt3']}
                onChange={jest.fn()}
                multi={true}
            />,
        ));

        expect(screen.getByText('Open')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
    });

    test('adds an option id to the array when picked from the menu', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1']}
                onChange={onChange}
                multi={true}
            />,
        ));

        openMenu();
        fireEvent.click(screen.getByRole('option', {name: 'In Progress'}));

        expect(onChange).toHaveBeenCalledWith(['opt1', 'opt2']);
    });
});
