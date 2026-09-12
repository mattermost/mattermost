// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import type {TableRow} from './value_selector_menu';
import ValueSelectorMenu from './value_selector_menu';

jest.mock('components/property_fields/graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('components/property_fields/graph/page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

beforeEach(() => {
    mockPageAll.mockReset();
    mockPageAll.mockImplementation(() => {
        throw new Error('pageAllAccessControlFieldOptions was called by a test that queued no response');
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

    test('mounts the hierarchy picker for a graph row', async () => {
        mockPageAll.mockReset();
        mockPageAll.mockResolvedValue([{id: 'opt-air', name: 'Air Program'} as PropertyFieldOption]);

        renderGraph(graphField([{id: 'opt-air', name: 'Air Program'} as PropertyFieldOption]), graphRow());
        fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

        expect(await screen.findByRole('textbox', {name: 'Search values'})).toBeInTheDocument();
        expect(mockPageAll).toHaveBeenCalled();
        expect(screen.queryByText(/Create /)).not.toBeInTheDocument();
    });

    test('pages options for an omitted graph instead of offering create', async () => {
        mockPageAll.mockReset();
        mockPageAll.mockResolvedValue([{id: 'opt-air', name: 'Air Program'} as PropertyFieldOption]);

        renderGraph(graphField(), graphRow());
        fireEvent.click(screen.getByTestId('valueSelectorMenuButton'));

        expect(await screen.findByRole('textbox', {name: 'Search values'})).toBeInTheDocument();
        expect(mockPageAll).toHaveBeenCalled();
        expect(screen.queryByText(/Create /)).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: /create/i})).not.toBeInTheDocument();
    });
});
