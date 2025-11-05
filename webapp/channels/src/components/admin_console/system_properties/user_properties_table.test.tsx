// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';
import {collectionFromArray} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import {UserPropertiesTable} from './user_properties_table';

jest.mock('./user_properties_delete_modal', () => ({
    useUserPropertyFieldDelete: jest.fn(() => ({
        promptDelete: jest.fn().mockResolvedValue(true),
    })),
}));

describe('UserPropertiesTable', () => {
    const baseFields: UserPropertyField[] = [
        {
            id: 'field1',
            name: 'Field 1',
            type: 'text',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            delete_at: 0,
            update_at: 0,
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
            },
        },
        {
            id: 'field2',
            name: 'Field 2',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            delete_at: 0,
            update_at: 0,
            attrs: {
                sort_order: 1,
                visibility: 'when_set',
                value_type: '',
                options: [
                    {id: 'option1', name: 'Option 1'},
                    {id: 'option2', name: 'Option 2'},
                ],
            },
        },
    ];

    const createField = jest.fn();
    const updateField = jest.fn();
    const deleteField = jest.fn();
    const reorderField = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = (fields = baseFields) => {
        const collection = collectionFromArray(fields);

        return renderWithContext(
            <UserPropertiesTable
                data={collection}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );
    };

    it('renders table with correct attribute fields', () => {
        renderComponent();

        // Check column headers
        expect(screen.getByText('Attribute')).toBeInTheDocument();
        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByText('Values')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();

        // Check field values
        expect(screen.getByDisplayValue('Field 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Field 2')).toBeInTheDocument();
        expect(screen.getByText('Text')).toBeInTheDocument();
        expect(screen.getByText('Select')).toBeInTheDocument();
    });

    it('allows editing field names', () => {
        renderComponent();

        const field1Input = screen.getByDisplayValue('Field 1');
        fireEvent.change(field1Input, {target: {value: 'Edited Field 1'}});
        fireEvent.blur(field1Input);

        expect(updateField).toHaveBeenCalledWith({
            ...baseFields[0],
            name: 'Edited Field 1',
        });
    });

    it('shows type selection menu', () => {
        renderComponent();

        // Check the type selectors exist
        expect(screen.getByText('Text')).toBeInTheDocument();
        expect(screen.getByText('Select')).toBeInTheDocument();
    });

    it('shows dot menu for actions', () => {
        renderComponent();

        // Check that dot menus exist
        const dotMenuButtons = screen.getAllByTestId(/user-property-field_dotmenu-/);
        expect(dotMenuButtons).toHaveLength(2);
    });

    it('handles deleted fields correctly', () => {
        const deletedFields = [
            ...baseFields,
            {
                ...baseFields[0],
                id: 'deleted-field',
                name: 'Deleted Field',
                delete_at: 123456789,
            },
        ];

        renderComponent(deletedFields);

        // Deleted field should still be in the table but have disabled inputs
        const deletedInput = screen.getByDisplayValue('Deleted Field');
        expect(deletedInput).toBeDisabled();
    });

    it('displays validation warnings', async () => {
        const fields = [...baseFields];
        const collection = collectionFromArray(fields);

        // Add validation warnings
        collection.warnings = {
            field1: {name: 'user_properties.validation.name_required'},
        };

        renderWithContext(
            <UserPropertiesTable
                data={collection}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        // Validation error should be shown
        await waitFor(() => {
            expect(screen.getByText('Please enter an attribute name.')).toBeInTheDocument();
        });
    });

    it('autofocuses name input for new text field', () => {
        const pendingTextField: UserPropertyField = {
            id: 'pending-text',
            name: '',
            type: 'text',
            group_id: 'custom_profile_attributes',
            create_at: 0,
            delete_at: 0,
            update_at: 0,
            attrs: {
                sort_order: 2,
                visibility: 'when_set',
                value_type: '',
            },
        };

        renderComponent([...baseFields, pendingTextField]);

        // The name input for the new text field should be autofocused
        const nameInputs = screen.getAllByTestId('property-field-input');
        expect(document.activeElement).toBe(nameInputs[2]);
    });

    it('autofocuses values input for new select field', () => {
        const pendingSelectField: UserPropertyField = {
            id: 'pending-select',
            name: 'New Select',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 0,
            delete_at: 0,
            update_at: 0,
            attrs: {
                sort_order: 2,
                visibility: 'when_set',
                value_type: '',
                options: [],
            },
        };

        renderComponent([...baseFields, pendingSelectField]);

        // The values input (combobox) for the new select field should be autofocused
        const comboboxes = screen.getAllByRole('combobox');
        expect(document.activeElement).toBe(comboboxes[comboboxes.length - 1]);
    });

    it('autofocuses values input for new multiselect field', () => {
        const pendingMultiselectField: UserPropertyField = {
            id: 'pending-multiselect',
            name: 'New Multiselect',
            type: 'multiselect',
            group_id: 'custom_profile_attributes',
            create_at: 0,
            delete_at: 0,
            update_at: 0,
            attrs: {
                sort_order: 2,
                visibility: 'when_set',
                value_type: '',
                options: [],
            },
        };

        renderComponent([...baseFields, pendingMultiselectField]);

        // The values input (combobox) for the new multiselect field should be autofocused
        const comboboxes = screen.getAllByRole('combobox');
        expect(document.activeElement).toBe(comboboxes[comboboxes.length - 1]);
    });
});
