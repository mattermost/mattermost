// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import BoardPropertiesDotMenu from './board_properties_dot_menu';

describe('BoardPropertiesDotMenu', () => {
    const baseField: PropertyField = {
        id: 'test-id',
        name: 'Test Field',
        type: 'text',
        group_id: 'board_attributes',
        create_at: 1736541716295,
        delete_at: 0,
        update_at: 0,
        created_by: '',
        updated_by: '',
        attrs: {
            sort_order: 0,
        },
    };

    const updateField = jest.fn();
    const deleteField = jest.fn();
    const createField = jest.fn();

    const renderComponent = (field: PropertyField = baseField, dotMenuProps?: Partial<ComponentProps<typeof BoardPropertiesDotMenu>>) => {
        return renderWithContext(
            <BoardPropertiesDotMenu
                field={field}
                canCreate={true}
                {...dotMenuProps}
                updateField={updateField}
                deleteField={deleteField}
                createField={createField}
            />,
        );
    };

    it('renders dot menu button', () => {
        renderComponent();

        const menuButton = screen.getByTestId(`board-property-field-dotmenu-${baseField.id}`);
        expect(menuButton).toBeInTheDocument();
    });

    it('disables menu button when field is marked for deletion', () => {
        const deletedField = {
            ...baseField,
            delete_at: 123456789,
        };

        renderComponent(deletedField);

        const menuButton = screen.getByTestId(`board-property-field-dotmenu-${deletedField.id}`);
        expect(menuButton).toBeDisabled();
    });

    it('handles field duplication', async () => {
        renderComponent();

        // Open the menu
        const menuButton = screen.getByTestId(`board-property-field-dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Click the duplicate option
        await userEvent.click(screen.getByText(/Duplicate attribute/));

        // Wait for createField to be called
        await waitFor(() => {
            // Verify createField was called with the correct parameters
            expect(createField).toHaveBeenCalledWith(expect.objectContaining({
                id: expect.stringContaining('temp_'),
                name: 'Test Field (copy)',
            }));
        });
    });

    it('hides field duplication when at field limit', async () => {
        renderComponent(undefined, {canCreate: false});

        // Open the menu
        const menuButton = screen.getByTestId(`board-property-field-dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Verify duplicate option is not shown
        expect(screen.queryByText(/Duplicate attribute/)).not.toBeInTheDocument();
    });

    it('handles field deletion', async () => {
        renderComponent();

        // Open the menu
        const menuButton = screen.getByTestId(`board-property-field-dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Click delete option
        const deleteOption = screen.getByRole('menuitem', {name: /Delete/});
        await userEvent.click(deleteOption);

        await waitFor(() => {
            // Verify deleteField was called
            expect(deleteField).toHaveBeenCalledWith(baseField.id);
        });
    });

    it('handles field deletion for newly created field', async () => {
        const pendingField = {
            ...baseField,
            create_at: 0, // Mark as pending creation
        };

        renderComponent(pendingField);

        // Open the menu
        const menuButton = screen.getByTestId(`board-property-field-dotmenu-${pendingField.id}`);
        await userEvent.click(menuButton);

        // Click delete option
        const deleteOption = screen.getByRole('menuitem', {name: /Delete/});
        await userEvent.click(deleteOption);

        await waitFor(() => {
            // Verify deleteField was called
            expect(deleteField).toHaveBeenCalledWith(pendingField.id);
        });
    });

    it('clears option IDs when duplicating a select field', async () => {
        const selectField: PropertyField = {
            ...baseField,
            type: 'select',
            attrs: {
                sort_order: 0,
                options: [
                    {id: 'option1', name: 'Option 1'},
                    {id: 'option2', name: 'Option 2'},
                ],
            },
        };

        renderComponent(selectField);

        // Open the menu
        const menuButton = screen.getByTestId(`board-property-field-dotmenu-${selectField.id}`);
        await userEvent.click(menuButton);

        // Click the duplicate option
        await userEvent.click(screen.getByText(/Duplicate attribute/));

        // Wait for createField to be called
        await waitFor(() => {
            expect(createField).toHaveBeenCalled();
            const callArgs = createField.mock.calls[0][0];
            expect(callArgs.attrs?.options).toEqual([
                {id: '', name: 'Option 1'},
                {id: '', name: 'Option 2'},
            ]);
        });
    });
});
