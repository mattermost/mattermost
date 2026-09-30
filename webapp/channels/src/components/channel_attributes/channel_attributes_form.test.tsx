// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';

import {clearPropertyFieldOptionWalks} from 'components/property_fields/graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache} from 'components/property_fields/graph/use_graph_option_names';

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

    test('names a select control with its field label, not the shared placeholder', () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('combobox', {name: 'Program'})).toBeInTheDocument();
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

    describe('graph attributes', () => {
        const graphProgram = field({
            id: 'f_graph_program',
            name: 'graph_program',
            type: 'graph',
            attrs: {display_name: 'Graph Program'},
        });

        beforeEach(() => {
            // The picker pages the options endpoint and caches the walk and the
            // option names at module level, so both outlive a single test.
            clearPropertyFieldOptionWalks();
            clearGraphOptionNameCache();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue({
                options: [{id: 'opt_program', name: 'VALUE_PROGRAM', create_at: 1}],
                has_more: false,
            });
        });

        test('renders the picker and reports the picked option id', async () => {
            const onChange = jest.fn();
            renderWithContext(
                <ChannelAttributesForm
                    fields={[graphProgram]}
                    values={{}}
                    onChange={onChange}
                />,
            );

            expect(screen.getByTestId('channelAttributeRow-graph_program')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('channelAttribute-graph_program'));
            await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'VALUE_PROGRAM'}));

            expect(onChange).toHaveBeenCalledWith('f_graph_program', ['opt_program']);
        });

        test('deselecting the only selected value reports undefined, so no row is written', async () => {
            const onChange = jest.fn();
            renderWithContext(
                <ChannelAttributesForm
                    fields={[graphProgram]}
                    values={{f_graph_program: ['opt_program']}}
                    onChange={onChange}
                />,
            );

            await userEvent.click(screen.getByTestId('channelAttribute-graph_program'));
            const option = await screen.findByRole('menuitemcheckbox', {name: 'VALUE_PROGRAM'});
            expect(option).toHaveAttribute('aria-checked', 'true');

            await userEvent.click(option);

            expect(onChange).toHaveBeenCalledWith('f_graph_program', undefined);
        });
    });
});
