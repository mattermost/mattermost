// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';
import {collectionFromArray} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import {UserPropertiesTable, useUserPropertiesTable} from './user_properties_table';
import {ValidationWarningNameInvalidCEL} from './user_properties_utils';

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
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
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
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
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

    const renderComponent = (fields = baseFields, collection = collectionFromArray(fields)) => {
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
        expect(screen.getByText('Identifier')).toBeInTheDocument();
        expect(screen.getByText('CEL identifier used in policies')).toBeInTheDocument();
        expect(screen.getByText('Display name')).toBeInTheDocument();
        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByText('Values')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();

        // Check field values
        expect(screen.getByDisplayValue('Field 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Field 2')).toBeInTheDocument();
        expect(screen.getByText('Text')).toBeInTheDocument();
        expect(screen.getByText('Select')).toBeInTheDocument();
        expect(screen.getAllByTestId('property-display-name-input')[0]).toHaveValue('');
    });

    it('shows display_name value in the Display name column', () => {
        const fields = baseFields.map((field, index) => ({
            ...field,
            attrs: {...field.attrs, display_name: `Display ${index + 1}`},
        }));

        renderComponent(fields);

        expect(screen.getByDisplayValue('Display 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Display 2')).toBeInTheDocument();
    });

    it('allows editing field names', async () => {
        renderComponent();

        const field1Input = screen.getByDisplayValue('Field 1');
        await userEvent.clear(field1Input);
        await userEvent.type(field1Input, 'Edited Field 1');

        // Trigger blur to save the edited field name - fireEvent used because userEvent doesn't have direct focus/blur methods
        fireEvent.blur(field1Input);

        expect(updateField).toHaveBeenCalledWith({
            ...baseFields[0],
            name: 'Edited Field 1',
        });
    });

    it('calls updateField with updated display_name on blur', async () => {
        renderComponent();

        const displayNameInput = screen.getAllByTestId('property-display-name-input')[0];
        await userEvent.type(displayNameInput, 'Department Head');
        fireEvent.blur(displayNameInput);

        expect(updateField).toHaveBeenCalledWith(expect.objectContaining({
            attrs: expect.objectContaining({display_name: 'Department Head'}),
        }));
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

    it('shows CEL validation error for invalid identifiers', async () => {
        const collection = collectionFromArray(baseFields);
        collection.warnings = {
            field1: {name: ValidationWarningNameInvalidCEL},
        };

        renderComponent(baseFields, collection);

        await waitFor(() => {
            expect(screen.getByText(/Identifier must start with a letter or underscore/)).toBeInTheDocument();
        });
    });

    it('editing display_name of a legacy invalid-named field does not fire CEL warning', async () => {
        const legacyField = {
            ...baseFields[0],
            name: 'My Legacy Field',
        };

        renderComponent([legacyField]);

        const displayNameInput = screen.getByTestId('property-display-name-input');
        await userEvent.type(displayNameInput, 'Legacy Display');
        fireEvent.blur(displayNameInput);

        expect(screen.queryByText(/Identifier must start with a letter or underscore/)).not.toBeInTheDocument();
    });

    it('editing identifier of a legacy field triggers CEL validation', async () => {
        const legacyField = {...baseFields[0], name: 'My Legacy Field'};
        const collection = collectionFromArray([legacyField]);
        collection.warnings = {
            [legacyField.id]: {name: ValidationWarningNameInvalidCEL},
        };

        renderComponent([legacyField], collection);

        await waitFor(() => {
            expect(screen.getByText(/Reserved CEL words are not allowed/)).toBeInTheDocument();
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
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
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
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
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
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
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

describe('useUserPropertiesTable grandfather regression', () => {
    const getFields = jest.spyOn(Client4, 'getCustomProfileAttributeFields');
    const patchField = jest.spyOn(Client4, 'patchCustomProfileAttributeField');

    afterEach(() => {
        getFields.mockReset();
        patchField.mockReset();
    });

    it('rename of legacy field clears grandfather: subsequent edits to the now-valid name trigger validation', async () => {
        const legacyField: UserPropertyField = {
            id: 'legacy-field',
            name: 'dept head',
            type: 'text',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            delete_at: 0,
            update_at: 0,
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
            },
        };

        getFields.mockResolvedValue([legacyField]);
        patchField.mockImplementation(async (id, patch) => ({
            ...legacyField,
            ...patch,
            id,
            attrs: {
                ...legacyField.attrs,
                ...patch.attrs,
            },
            update_at: Date.now(),
        } as UserPropertyField));

        let latestSection!: ReturnType<typeof useUserPropertiesTable>;
        const HookHarness = () => {
            latestSection = useUserPropertiesTable();
            return <>{latestSection.content}</>;
        };

        renderWithContext(<HookHarness/>);

        await waitFor(() => {
            expect(screen.getByDisplayValue('dept head')).toBeInTheDocument();
        });

        const identifierInput = screen.getByDisplayValue('dept head');
        await userEvent.clear(identifierInput);
        await userEvent.type(identifierInput, 'dept_head');
        fireEvent.blur(identifierInput);

        await act(async () => {
            await latestSection.save();
        });

        await waitFor(() => {
            expect(patchField).toHaveBeenCalledWith('legacy-field', expect.objectContaining({name: 'dept_head'}));
            expect(screen.getByDisplayValue('dept_head')).toBeInTheDocument();
        });

        const renamedInput = screen.getByDisplayValue('dept_head');
        await userEvent.clear(renamedInput);
        await userEvent.type(renamedInput, '42dept');
        fireEvent.blur(renamedInput);

        await waitFor(() => {
            expect(screen.getByText(/Identifier must start with a letter or underscore/)).toBeInTheDocument();
        });
    });
});
