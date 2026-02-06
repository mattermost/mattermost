// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import BoardPropertiesTypeMenu from './board_properties_type_menu';

describe('BoardPropertiesTypeMenu', () => {
    const baseField: PropertyField = {
        id: 'test-id',
        name: 'Test Field',
        type: 'text' as const,
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

    const renderComponent = (field: PropertyField = baseField) => {
        return renderWithContext(
            <BoardPropertiesTypeMenu
                field={field}
                updateField={updateField}
            />,
        );
    };

    it('renders with correct current type', () => {
        renderComponent();

        // The menu button should show the current type
        expect(screen.getByText('Text')).toBeInTheDocument();
    });

    it('disables menu button when field is marked for deletion', () => {
        const deletedField = {
            ...baseField,
            delete_at: 123456789,
        };

        renderComponent(deletedField);

        // Find button and verify it's disabled
        const menuButton = screen.getByTestId('fieldTypeSelectorMenuButton');
        expect(menuButton).toBeDisabled();
    });

    it('changes field type when a new type is selected', async () => {
        renderComponent();

        // Open the menu
        await userEvent.click(screen.getByText('Text'));

        // Click to select Select type
        await userEvent.click(screen.getByText('Select'));

        // Verify the field was updated with the new type
        expect(updateField).toHaveBeenCalledWith({
            ...baseField,
            type: 'select',
            attrs: {
                ...baseField.attrs,
            },
        });
    });

    it('filters options when searching', async () => {
        renderComponent();

        // Open the menu
        await userEvent.click(screen.getByText('Text'));

        // Wait for menu to open and find the filter input by role
        const filterInput = await screen.findByRole('textbox', {name: 'Attribute type'});
        await userEvent.clear(filterInput);
        await userEvent.type(filterInput, 'multi');

        // Should only see Multi-select and Multi-user now
        expect(screen.getByText('Multi-select')).toBeInTheDocument();
        expect(screen.getByText('Multi-user')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
    });

    it('shows check icon for current type', async () => {
        const selectField = {
            ...baseField,
            type: 'select' as const,
            attrs: {
                ...baseField.attrs,
            },
        };

        renderComponent(selectField);

        // Open the menu
        await userEvent.click(screen.getByText('Select'));

        // Select should have a check
        expect(screen.getByRole('menuitemradio', {name: 'Select'})).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Text'})).toHaveAttribute('aria-checked', 'false');
    });

    it('supports all board attribute types', async () => {
        renderComponent();

        // Open the menu
        await userEvent.click(screen.getByText('Text'));

        // Wait for menu to open, then check that all board attribute types are available as menu items
        // Note: The button text "Text" is still visible, but we're checking for menu items
        await screen.findByRole('menuitemradio', {name: 'Text'});
        expect(screen.getByRole('menuitemradio', {name: 'Text'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Select'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Multi-select'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Date'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'User'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Multi-user'})).toBeInTheDocument();
    });

    it('clears options when changing from select to non-select type', async () => {
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
        await userEvent.click(screen.getByText('Select'));

        // Change to text type
        await userEvent.click(screen.getByText('Text'));

        // Verify options were cleared
        expect(updateField).toHaveBeenCalledWith({
            ...selectField,
            type: 'text',
            attrs: {
                sort_order: 0,

                // options should be removed
            },
        });

        const attrs = updateField.mock.calls[0][0].attrs;
        expect(attrs).not.toHaveProperty('options');
    });

    it('preserves options when changing between select and multiselect', async () => {
        const selectField: PropertyField = {
            ...baseField,
            type: 'select',
            attrs: {
                sort_order: 0,
                options: [
                    {id: 'option1', name: 'Option 1'},
                ],
            },
        };

        renderComponent(selectField);

        // Open the menu
        await userEvent.click(screen.getByText('Select'));

        // Change to multiselect type
        await userEvent.click(screen.getByText('Multi-select'));

        // Verify options were preserved
        expect(updateField).toHaveBeenCalledWith({
            ...selectField,
            type: 'multiselect',
            attrs: {
                sort_order: 0,
                options: [
                    {id: 'option1', name: 'Option 1'},
                ],
            },
        });
    });
});
