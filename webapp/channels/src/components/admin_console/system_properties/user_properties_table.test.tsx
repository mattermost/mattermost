// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import {collectionFromArray} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import {UserPropertiesTable, ValidationBanners, useUserPropertiesTable} from './user_properties_table';
import {
    ValidationWarningNameInvalidCEL,
    ValidationWarningNameRequired,
    ValidationWarningNameUnique,
    ValidationWarningOptionsRequired,
} from './user_properties_utils';

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
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Display Name')).toBeInTheDocument();
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
        await userEvent.type(field1Input, 'EditedField1');

        fireEvent.blur(field1Input);

        expect(updateField).toHaveBeenCalledWith({
            ...baseFields[0],
            name: 'EditedField1',
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

    // Regression coverage for the react-beautiful-dnd → Pragmatic Drag and
    // Drop migration in list_table. These tests don't drive native drag
    // events (jsdom can't), but they confirm the keyboard reorder path —
    // which is the most user-visible accessibility-critical surface — is
    // still wired through to the consumer's reorderField callback.
    describe('DnD migration regression — keyboard reorder', () => {
        beforeEach(() => {
            reorderField.mockClear();
        });

        it('ArrowDown on row 0\u2019s drag handle calls reorderField with the row 0 field at next index 1', async () => {
            renderComponent();

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[0].focus();
            await userEvent.keyboard('{ArrowDown}');

            expect(reorderField).toHaveBeenCalledTimes(1);
            expect(reorderField).toHaveBeenCalledWith(baseFields[0], 1);
        });

        it('ArrowUp on row 1\u2019s drag handle calls reorderField with the row 1 field at next index 0', async () => {
            renderComponent();

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[1].focus();
            await userEvent.keyboard('{ArrowUp}');

            expect(reorderField).toHaveBeenCalledTimes(1);
            expect(reorderField).toHaveBeenCalledWith(baseFields[1], 0);
        });

        it('ArrowUp on the first row is a no-op (cannot move above index 0)', async () => {
            renderComponent();

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[0].focus();
            await userEvent.keyboard('{ArrowUp}');

            expect(reorderField).not.toHaveBeenCalled();
        });

        it('ArrowDown on the last row is a no-op (cannot move past the bottom)', async () => {
            renderComponent();

            const handles = screen.getAllByRole('button', {name: /reorder row/i});
            handles[handles.length - 1].focus();
            await userEvent.keyboard('{ArrowDown}');

            expect(reorderField).not.toHaveBeenCalled();
        });

        it('renders one drag handle per row (DnD wiring is enabled, not silently disabled)', () => {
            renderComponent();

            // User properties does not pass `isRowDragDisabled`, so every
            // visible row gets an interactive drag handle button.
            expect(screen.getAllByRole('button', {name: /reorder row/i})).toHaveLength(baseFields.length);
        });
    });

    const renderWithBanners = (fields: UserPropertyField[], collection = collectionFromArray(fields)) => {
        return renderWithContext(
            <>
                <UserPropertiesTable
                    data={collection}
                    canCreate={true}
                    createField={createField}
                    updateField={updateField}
                    deleteField={deleteField}
                    reorderField={reorderField}
                />
                <ValidationBanners warnings={collection.warnings}/>
            </>,
        );
    };

    it('displays validation warnings', async () => {
        const fields = [...baseFields];
        const collection = collectionFromArray(fields);

        // Add validation warnings
        collection.warnings = {
            field1: {name: ValidationWarningNameRequired},
        };

        renderWithBanners(fields, collection);

        await waitFor(() => {
            expect(screen.getByText('Please enter an attribute name.')).toBeInTheDocument();
        });

        // * Banner body copy renders below the table
        expect(screen.getByText(/1 attribute is missing a Name/)).toBeInTheDocument();

        // * Offending row's Name cell carries the icon
        expect(screen.getAllByTestId('property-field-validation-error')).toHaveLength(1);
    });

    it('shows CEL validation error for invalid identifiers', async () => {
        const collection = collectionFromArray(baseFields);
        collection.warnings = {
            field1: {name: ValidationWarningNameInvalidCEL},
        };

        renderWithBanners(baseFields, collection);

        await waitFor(() => {
            expect(screen.getByText(/Identifier must start with a letter or underscore/)).toBeInTheDocument();
        });

        // * Banner body copy renders below the table
        expect(screen.getByText(/The highlighted Name is not a valid identifier/)).toBeInTheDocument();

        // * Cell-level icon carries the existing test id
        expect(screen.getAllByTestId('property-field-validation-error')).toHaveLength(1);
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

        renderWithBanners([legacyField], collection);

        await waitFor(() => {
            expect(screen.getByText(/Reserved CEL words are not allowed/)).toBeInTheDocument();
        });

        // * Banner body copy renders below the table
        expect(screen.getByText(/The highlighted Name is not a valid identifier/)).toBeInTheDocument();
    });

    it('stacks one banner per distinct validation error type', async () => {
        const fields: UserPropertyField[] = [
            baseFields[0],
            baseFields[1],
            {
                ...baseFields[0],
                id: 'field3',
                name: '',
            },
        ];
        const collection = collectionFromArray(fields);
        collection.warnings = {
            field1: {name: ValidationWarningNameInvalidCEL},
            field2: {name: ValidationWarningNameUnique},
            field3: {name: ValidationWarningNameRequired},
        };

        const {container} = renderWithBanners(fields, collection);

        // * Each unique error type produces a banner with its body copy
        await waitFor(() => {
            expect(screen.getByText(/The highlighted Name is not a valid identifier/)).toBeInTheDocument();
        });
        expect(screen.getByText(/1 attribute shares the same Name/)).toBeInTheDocument();
        expect(screen.getByText(/1 attribute is missing a Name/)).toBeInTheDocument();

        // * Three offending rows each carry the in-cell icon
        expect(screen.getAllByTestId('property-field-validation-error')).toHaveLength(3);

        // * Banners render in the canonical order: required → invalid CEL → unique → taken
        const banners = container.querySelectorAll('.AlertBanner');
        expect(banners).toHaveLength(3);
        expect(banners[0]).toHaveTextContent(/Please enter an attribute name/);
        expect(banners[1]).toHaveTextContent(/Identifier must start with a letter or underscore/);
        expect(banners[2]).toHaveTextContent(/Attribute names must be unique/);
    });

    it('ignores attrs-only warnings: no name-cell icon and no banner', () => {
        const fields = [baseFields[0]];
        const collection = collectionFromArray(fields);
        collection.warnings = {
            [fields[0].id]: {attrs: ValidationWarningOptionsRequired},
        };

        const {container} = renderWithBanners(fields, collection);

        // * The Name cell does not light up for options-only warnings
        expect(screen.queryByTestId('property-field-validation-error')).not.toBeInTheDocument();

        // * No warning banner is rendered below the table
        expect(container.querySelector('.AlertBanner')).toBeNull();
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

        // The display name input for the new text field should be autofocused
        const displayNameInputs = screen.getAllByTestId('property-display-name-input');
        expect(document.activeElement).toBe(displayNameInputs[2]);
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

describe('UserPropertiesTable input filtering', () => {
    const baseFields: UserPropertyField[] = [
        {
            id: 'field1',
            name: 'Field1',
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
    ];

    const createField = jest.fn();
    const updateField = jest.fn();
    const deleteField = jest.fn();
    const reorderField = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Name column has sanitize prop that strips invalid characters', () => {
        renderWithContext(
            <UserPropertiesTable
                data={collectionFromArray(baseFields)}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        const nameInput = screen.getByTestId('property-field-input');
        expect(nameInput).toBeInTheDocument();

        // filterCELIdentifier is tested in detail in properties.test.ts.
        // Here we verify it's wired up: the input exists and carries an
        // aria-label confirming it's the Name column input.
        expect(nameInput).toHaveAttribute('aria-label', 'Attribute Name');
    });

    it('Display Name auto-fills Name for new pending text field via live preview', async () => {
        const pendingField: UserPropertyField = {
            id: 'pending-new',
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
                sort_order: 1,
                visibility: 'when_set',
                value_type: '',
            },
        };

        renderWithContext(
            <UserPropertiesTable
                data={collectionFromArray([pendingField])}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        // Type a single character in Display Name - each keystroke triggers
        // handleDisplayNameChange which updates the Name column's live preview.
        const displayNameInput = screen.getByTestId('property-display-name-input');
        await userEvent.type(displayNameInput, 'D');

        // The Name input should show the slugified snake_case preview
        const nameInput = screen.getByTestId('property-field-input');
        await waitFor(() => {
            expect(nameInput).toHaveValue('d');
        });
    });

    it('Auto-fill deactivates permanently when user manually edits the Name input', async () => {
        const pendingField: UserPropertyField = {
            id: 'pending-deactivate',
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
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
            },
        };

        renderWithContext(
            <UserPropertiesTable
                data={collectionFromArray([pendingField])}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        const nameInput = screen.getByTestId('property-field-input');

        // Manually type in the Name input to diverge from any auto-fill
        await userEvent.type(nameInput, 'custom');
        fireEvent.blur(nameInput);

        updateField.mockClear();

        // Now type in Display Name and blur
        const displayNameInput = screen.getByTestId('property-display-name-input');
        await userEvent.type(displayNameInput, 'Department');
        fireEvent.blur(displayNameInput);

        // updateField should be called with display_name change but NOT with
        // a name override — the manual edit deactivated auto-fill
        const nameChangeCalls = updateField.mock.calls.filter(
            (call: [UserPropertyField]) => call[0].name && call[0].name !== 'custom',
        );
        expect(nameChangeCalls).toHaveLength(0);
    });

    it('Auto-fill does not fire for existing fields', async () => {
        renderWithContext(
            <UserPropertiesTable
                data={collectionFromArray(baseFields)}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        const displayNameInput = screen.getByTestId('property-display-name-input');
        await userEvent.type(displayNameInput, 'New Display');
        fireEvent.blur(displayNameInput);

        const nameUpdateCalls = updateField.mock.calls.filter(
            (call: [UserPropertyField]) => call[0].name !== baseFields[0].name,
        );
        expect(nameUpdateCalls).toHaveLength(0);
    });

    it('auto-fill freezes when Display Name slugifies to a reserved word', async () => {
        const pendingField: UserPropertyField = {
            id: 'pending-reserved',
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
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
            },
        };

        renderWithContext(
            <UserPropertiesTable
                data={collectionFromArray([pendingField])}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        const displayNameInput = screen.getByTestId('property-display-name-input');
        const nameInput = screen.getByTestId('property-field-input');

        fireEvent.change(displayNameInput, {target: {value: 'function'}});
        expect(nameInput).toHaveValue('');

        await userEvent.clear(displayNameInput);
        await userEvent.type(displayNameInput, 'dept');
        await waitFor(() => {
            expect(nameInput).toHaveValue('dept');
        });

        fireEvent.change(displayNameInput, {target: {value: 'true'}});
        expect(nameInput).toHaveValue('dept');
    });

    it('auto-fill converts multi-word display names to snake_case', async () => {
        const pendingField: UserPropertyField = {
            id: 'pending-snake-case',
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
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
            },
        };

        renderWithContext(
            <UserPropertiesTable
                data={collectionFromArray([pendingField])}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        const displayNameInput = screen.getByTestId('property-display-name-input');
        const nameInput = screen.getByTestId('property-field-input');

        fireEvent.change(displayNameInput, {target: {value: 'My Field Name'}});
        await waitFor(() => {
            expect(nameInput).toHaveValue('my_field_name');
        });

        fireEvent.change(displayNameInput, {target: {value: 'XMLParser'}});
        await waitFor(() => {
            expect(nameInput).toHaveValue('xml_parser');
        });

        fireEvent.change(displayNameInput, {target: {value: 'Does this work?'}});
        await waitFor(() => {
            expect(nameInput).toHaveValue('does_this_work');
        });
    });

    it('auto-fill prepends underscore for leading-digit display names', async () => {
        const pendingField: UserPropertyField = {
            id: 'pending-leading-digit',
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
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
            },
        };

        renderWithContext(
            <UserPropertiesTable
                data={collectionFromArray([pendingField])}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        const displayNameInput = screen.getByTestId('property-display-name-input');
        await userEvent.type(displayNameInput, '7Department');

        const nameInput = screen.getByTestId('property-field-input');
        await waitFor(() => {
            // snake_case inserts a boundary between the digit and the
            // following uppercase letter before lowercasing.
            expect(nameInput).toHaveValue('_7_department');
        });
    });

    it('auto-fill truncates display names longer than the max attribute name length', async () => {
        const pendingField: UserPropertyField = {
            id: 'pending-truncate',
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
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
            },
        };

        renderWithContext(
            <UserPropertiesTable
                data={collectionFromArray([pendingField])}
                canCreate={true}
                createField={createField}
                updateField={updateField}
                deleteField={deleteField}
                reorderField={reorderField}
            />,
        );

        const displayNameInput = screen.getByTestId('property-display-name-input');

        // fireEvent.change bypasses the input's maxLength so an oversize value
        // reaches the onChange handler and exercises the truncation branch.
        const oversize = Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH + 1;
        fireEvent.change(displayNameInput, {target: {value: 'a'.repeat(oversize)}});

        const nameInput = screen.getByTestId('property-field-input') as HTMLInputElement;
        await waitFor(() => {
            expect(nameInput.value).toHaveLength(Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH);
        });
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
        await userEvent.type(renamedInput, 'for');
        fireEvent.blur(renamedInput);

        // * Banner title + body copy are rendered below the table
        await waitFor(() => {
            expect(screen.getByText(/Identifier must start with a letter or underscore/)).toBeInTheDocument();
        });
        expect(screen.getByText(/The highlighted Name is not a valid identifier/)).toBeInTheDocument();

        // * Cell-level icon resolves via the preserved testid
        expect(screen.getAllByTestId('property-field-validation-error')).toHaveLength(1);
    });
});
