// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import type {TableRow} from './value_selector_menu';
import ValueSelectorMenu from './value_selector_menu';

// A comparable channel attribute the row's user attribute can target instead of
// a literal value. Same shape as a CPA field; object_type marks it a channel
// (resource) attribute.
function channelField(name: string, type: UserPropertyField['type'], displayName: string): UserPropertyField {
    return {
        id: `cf_${name}`,
        name,
        type,
        group_id: 'channel_attributes',
        target_id: '',
        target_type: '',
        object_type: 'channel',
        attrs: {
            sort_order: 0,
            visibility: 'always',
            value_type: '',
            display_name: displayName,
        },
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    } as unknown as UserPropertyField;
}

const selectOptions: PropertyFieldOption[] = [
    {id: 'o1', name: 'engineering'} as PropertyFieldOption,
    {id: 'o2', name: 'sales'} as PropertyFieldOption,
];

function baseRow(overrides: Partial<TableRow> = {}): TableRow {
    return {
        attribute: 'team',
        operator: 'is',
        values: [],
        attribute_type: 'select',
        hasMaskedValues: false,
        ...overrides,
    };
}

describe('ValueSelectorMenu — consolidated value/channel-attribute dropdown', () => {
    const updateValues = jest.fn();
    const onSelectTarget = jest.fn();

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('option-based single field with channel targets', () => {
        const owningTeam = channelField('owningTeam', 'select', 'Owning team');

        function renderIt(row: TableRow) {
            renderWithContext(
                <ValueSelectorMenu
                    row={row}
                    disabled={false}
                    updateValues={updateValues}
                    options={selectOptions}
                    channelFields={[owningTeam]}
                    onSelectTarget={onSelectTarget}
                />,
            );
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        }

        test('shows both the VALUES options and the CHANNEL ATTRIBUTES section', () => {
            renderIt(baseRow());

            expect(screen.getByText('Values')).toBeInTheDocument();
            expect(screen.getByText('Channel attributes')).toBeInTheDocument();
            expect(screen.getByText('engineering')).toBeInTheDocument();
            expect(screen.getByText('Owning team')).toBeInTheDocument();
        });

        test('picking a value commits a literal value', () => {
            renderIt(baseRow());

            fireEvent.click(screen.getByText('sales'));
            expect(updateValues).toHaveBeenCalledWith(['sales']);
            expect(onSelectTarget).not.toHaveBeenCalled();
        });

        test('picking a channel attribute switches to target mode', () => {
            renderIt(baseRow());

            fireEvent.click(screen.getByText('Owning team'));
            expect(onSelectTarget).toHaveBeenCalledWith('owningTeam');
        });

        test('in target mode the button shows the channel attribute label', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow({targetAttribute: 'owningTeam'})}
                    disabled={false}
                    updateValues={updateValues}
                    options={selectOptions}
                    channelFields={[owningTeam]}
                    onSelectTarget={onSelectTarget}
                />,
            );

            // The button (before opening) renders the target's display label,
            // not a literal value.
            expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Owning team');
        });
    });

    describe('text field (no options) with channel targets', () => {
        const owningTeamText = channelField('owningTeamText', 'text', 'Owning team (text)');

        test('renders a free-text input atop the CHANNEL ATTRIBUTES list', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow({attribute_type: 'text'})}
                    disabled={false}
                    updateValues={updateValues}
                    options={[]}
                    channelFields={[owningTeamText]}
                    onSelectTarget={onSelectTarget}
                />,
            );
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            expect(screen.getByText('Channel attributes')).toBeInTheDocument();
            expect(screen.getByText('Owning team (text)')).toBeInTheDocument();

            const input = screen.getByRole('textbox');
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'platform'}});
            fireEvent.keyDown(input, {key: 'Enter'});

            expect(updateValues).toHaveBeenCalledWith(['platform']);
        });
    });

    describe('text field with no channel targets', () => {
        test('keeps the legacy bare input (no dropdown, no sections)', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow({attribute_type: 'text'})}
                    disabled={false}
                    updateValues={updateValues}
                    options={[]}
                />,
            );

            expect(screen.queryByTestId('valueSelectorMenuButton')).not.toBeInTheDocument();
            expect(screen.queryByText('Channel attributes')).not.toBeInTheDocument();

            const input = screen.getByRole('textbox');
            fireEvent.focus(input);
            fireEvent.change(input, {target: {value: 'platform'}});
            fireEvent.blur(input);
            expect(updateValues).toHaveBeenCalledWith(['platform']);
        });
    });

    describe('multiselect field (has any of) with channel targets', () => {
        const programs = channelField('channelPrograms', 'multiselect', 'Channel programs');

        function renderMulti(row: TableRow) {
            renderWithContext(
                <ValueSelectorMenu
                    row={row}
                    disabled={false}
                    updateValues={updateValues}
                    options={selectOptions}
                    channelFields={[programs]}
                    onSelectTarget={onSelectTarget}
                />,
            );
        }

        test('offers both multi-values and the channel attribute', () => {
            renderMulti(baseRow({operator: 'has any of', attribute_type: 'multiselect'}));
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            expect(screen.getByText('engineering')).toBeInTheDocument();
            expect(screen.getByText('Channel programs')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Channel programs'));
            expect(onSelectTarget).toHaveBeenCalledWith('channelPrograms');
        });

        test('in target mode the multiselect button shows the channel attribute label', () => {
            renderMulti(baseRow({operator: 'has any of', attribute_type: 'multiselect', targetAttribute: 'channelPrograms'}));

            expect(screen.getByTestId('valueSelectorMenuButton')).toHaveTextContent('Channel programs');
        });
    });

    describe('no channel targets on an option field', () => {
        test('renders values only, without the CHANNEL ATTRIBUTES section', () => {
            renderWithContext(
                <ValueSelectorMenu
                    row={baseRow()}
                    disabled={false}
                    updateValues={updateValues}
                    options={selectOptions}
                />,
            );
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            expect(screen.getByText('engineering')).toBeInTheDocument();
            expect(screen.queryByText('Channel attributes')).not.toBeInTheDocument();

            // Without a second section the "Values" section header is omitted too.
            expect(screen.queryByText('Values')).not.toBeInTheDocument();
        });
    });
});
