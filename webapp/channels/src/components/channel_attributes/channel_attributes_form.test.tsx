// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelAttributesForm from './channel_attributes_form';

function field(overrides: Partial<PropertyField> & {id: string; name: string}): PropertyField {
    return {
        group_id: 'group1',
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        ...overrides,
    };
}

const program = field({
    id: 'f_program',
    name: 'program',
    attrs: {display_name: 'Program', options: [{id: 'opt_a', name: 'AURORA'}, {id: 'opt_b', name: 'BOREALIS'}]},
});

describe('ChannelAttributesForm', () => {
    test('renders nothing when there is no field with a control', () => {
        const {container} = renderWithContext(
            <ChannelAttributesForm
                fields={[field({id: 'f_when', name: 'when', type: 'date'})]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing at all when there are no fields', () => {
        const {container} = renderWithContext(
            <ChannelAttributesForm
                fields={[]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('prefers display_name over the machine name', () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByText('Program')).toBeInTheDocument();
        expect(screen.queryByText('program')).not.toBeInTheDocument();
    });

    test('reports the selected option id, not its label', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{}}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByText('Select a value'));
        await userEvent.click(screen.getByText('AURORA'));

        expect(onChange).toHaveBeenCalledWith('f_program', 'opt_a');
    });

    test('reports a multiselect as an array of option ids', async () => {
        const onChange = jest.fn();
        const caveats = field({
            id: 'f_caveats',
            name: 'caveats',
            type: 'multiselect',
            attrs: {options: [{id: 'opt_a', name: 'NOFORN'}, {id: 'opt_b', name: 'ORCON'}]},
        });

        renderWithContext(
            <ChannelAttributesForm
                fields={[caveats]}
                values={{f_caveats: ['opt_a']}}
                onChange={onChange}
            />,
        );

        // The placeholder is gone once a chip is present, so the menu is opened
        // through the combobox itself.
        await userEvent.click(screen.getByRole('combobox'));
        await userEvent.click(screen.getByText('ORCON'));

        expect(onChange).toHaveBeenCalledWith('f_caveats', ['opt_a', 'opt_b']);
    });

    test('reports undefined when a text value is emptied, so no row is written', async () => {
        const onChange = jest.fn();
        const note = field({id: 'f_note', name: 'note', type: 'text'});

        renderWithContext(
            <ChannelAttributesForm
                fields={[note]}
                values={{f_note: 'x'}}
                onChange={onChange}
            />,
        );

        await userEvent.clear(screen.getByLabelText('note'));

        expect(onChange).toHaveBeenCalledWith('f_note', undefined);
    });

    test('caps a text value at the length the server accepts', () => {
        const note = field({id: 'f_note', name: 'note', type: 'text'});

        renderWithContext(
            <ChannelAttributesForm
                fields={[note]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByLabelText('note')).toHaveAttribute('maxLength', String(PROPERTY_TEXT_VALUE_MAX_LENGTH));
    });
});
