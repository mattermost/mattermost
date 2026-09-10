// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {pageAllAccessControlFieldOptions} from 'components/property_fields/page_all_property_field_options';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import type {TableRow} from './value_selector_menu';
import ValueSelectorMenu from './value_selector_menu';

// Every test in this file that leaves the flag off renders with an empty store,
// so the tree must never mount. If it ever does, the widget would call the real
// pager: setup_jest.ts assigns globalThis.fetch = nodeFetch, so it becomes an
// outbound request to localhost, and the widget swallows fetch failures into an
// error status. The test then fails on a missing element with no network error
// in the output -- a destroyed report rather than a named bug.
jest.mock('components/property_fields/page_all_property_field_options', () => ({
    ...jest.requireActual('components/property_fields/page_all_property_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

beforeEach(() => {
    mockPageAll.mockReset();
    mockPageAll.mockImplementation(() => {
        throw new Error('the flat picker fetched options: the graph tree mounted with the flag off');
    });
});

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

describe('GraphValueCell — graph value cell via ValueSelectorMenu', () => {
    const updateValues = jest.fn();

    afterEach(() => {
        jest.clearAllMocks();
    });

    function graphField(options?: PropertyFieldOption[]): UserPropertyField {
        return {
            id: 'user-programs',
            name: 'programs',
            type: 'graph',
            group_id: 'custom_profile_attributes',
            object_type: 'user',
            target_id: '',
            target_type: '',
            attrs: {
                sort_order: 0,
                visibility: 'always',
                value_type: '',

                // No options and the omitted markers is the >1000 regime, and
                // it is the one that turned create on: an absent list is
                // indistinguishable from an option-less attribute.
                ...(options ? {options} : {options_omitted: true, options_count: 1500}),
            },
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            created_by: '',
            updated_by: '',
        } as unknown as UserPropertyField;
    }

    const graphRow = (overrides: Partial<TableRow> = {}) => baseRow({
        attribute: 'programs',
        operator: 'coversAll',
        attribute_type: 'graph',
        ...overrides,
    });

    function renderGraph(field: UserPropertyField, row: TableRow, extra: Partial<React.ComponentProps<typeof ValueSelectorMenu>> = {}) {
        renderWithContext(
            <ValueSelectorMenu
                row={row}
                disabled={false}
                updateValues={updateValues}
                options={field.attrs?.options ?? []}
                field={field}
                {...extra}
            />,
        );
    }

    function openAndFilter(text: string) {
        fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));
        const input = screen.getByRole('textbox');
        fireEvent.change(input, {target: {value: text}});
        return input;
    }

    describe('flag off', () => {
        afterEach(() => {
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('offers no create item for an omitted graph with the flag off', () => {
            renderGraph(graphField(), graphRow());
            openAndFilter('Skunkworks');

            expect(screen.queryByText(/Create "Skunkworks"/)).not.toBeInTheDocument();
        });

        test('shows the search placeholder, not the create placeholder, for an omitted graph', () => {
            renderGraph(graphField(), graphRow());
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            // By accessible name rather than the placeholder attribute: Input
            // moves the placeholder text into its legend once focused and drops
            // the attribute, but keeps it on aria-label either way.
            expect(screen.getByRole('textbox', {name: 'Search values...'})).toBeInTheDocument();
            expect(screen.queryByRole('textbox', {name: /create/i})).not.toBeInTheDocument();
        });

        test('does not create a value on Enter in the filter for an omitted graph', () => {
            renderGraph(graphField(), graphRow());
            const input = openAndFilter('Skunkworks');

            fireEvent.keyDown(input, {key: 'Enter'});

            expect(updateValues).not.toHaveBeenCalled();
        });

        test('shows the select placeholder on the closed button for an omitted graph', () => {
            renderGraph(graphField(), graphRow({values: []}));

            const button = screen.getByTestId('valueSelectorMenuButton');
            expect(button).toHaveTextContent('Select values...');
            expect(button).not.toHaveTextContent('Type to create value');
        });

        test('still offers no create item for a hydrated graph', () => {
            renderGraph(graphField([{id: 'opt-air', name: 'Air Program'} as PropertyFieldOption]), graphRow());

            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));
            expect(screen.getByText('Air Program')).toBeInTheDocument();

            fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Skunkworks'}});
            expect(screen.queryByText(/Create "Skunkworks"/)).not.toBeInTheDocument();
        });

        test('does not persist the flag-off omitted sentinel if it is clicked', () => {
            renderGraph(graphField(), graphRow());
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            const items = screen.queryAllByRole('menuitemcheckbox');
            for (const item of items) {
                fireEvent.click(item);
            }

            expect(updateValues).not.toHaveBeenCalled();
        });
    });

    describe('flag on', () => {
        const graphEnabledState = {
            entities: {
                general: {
                    config: {
                        FeatureFlagPropertyFieldGraph: 'true',
                    },
                },
            },
        };

        beforeEach(() => {
            mockPageAll.mockReset();
            mockPageAll.mockResolvedValue([{id: 'opt-air', name: 'Air Program'} as PropertyFieldOption]);
        });

        test('mounts the hierarchy picker when PropertyFieldGraph is on', async () => {
            mockPageAll.mockReset();
            mockPageAll.mockResolvedValue([{id: 'opt-air', name: 'Air Program'} as PropertyFieldOption]);

            renderWithContext(
                <ValueSelectorMenu
                    row={graphRow()}
                    disabled={false}
                    updateValues={updateValues}
                    options={[]}
                    field={graphField([{id: 'opt-air', name: 'Air Program'} as PropertyFieldOption])}
                />,
                graphEnabledState,
            );
            fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

            expect(await screen.findByRole('textbox', {name: 'Search values'})).toBeInTheDocument();
            expect(screen.queryByRole('textbox', {name: 'Search values...'})).not.toBeInTheDocument();
            expect(mockPageAll).toHaveBeenCalled();
            expect(screen.queryByText(/Create /)).not.toBeInTheDocument();
        });
    });
});
