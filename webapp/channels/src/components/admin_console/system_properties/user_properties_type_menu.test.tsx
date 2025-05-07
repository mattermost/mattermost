// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import SelectType from './user_properties_type_menu';

describe('UserPropertyTypeMenu', () => {
    const baseField: UserPropertyField = {
        id: 'test-id',
        name: 'Test Field',
        type: 'text' as const,
        group_id: 'custom_profile_attributes',
        create_at: 1736541716295,
        delete_at: 0,
        update_at: 0,
        attrs: {
            sort_order: 0,
            visibility: 'when_set' as const,
            value_type: '',
        },
    };

    const updateField = jest.fn();

    const renderComponent = (field: UserPropertyField = baseField) => {
        return renderWithContext(
            <SelectType
                field={field}
                updateField={updateField}
            />,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders with correct current type', () => {
        renderComponent();

        // The menu button should show the current type
        expect(screen.getByText('Text')).toBeInTheDocument();
    });

    it('renders legacy text field with no value_type in attrs', () => {
        const legacyField = {
            ...baseField,
            type: 'text' as const,
            attrs: {
                sort_order: 0,
            },
        };

        renderComponent(legacyField as UserPropertyField);

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

    it('changes field type when a new type is selected', () => {
        renderComponent();

        // Open the menu
        fireEvent.click(screen.getByText('Text'));

        // Click to select Phone type
        fireEvent.click(screen.getByText('Phone'));

        // Verify the field was updated with the new type
        expect(updateField).toHaveBeenCalledWith({
            ...baseField,
            type: 'text',
            attrs: {
                ...baseField.attrs,
                value_type: 'phone',
            },
        });
    });

    it('filters options when searching', () => {
        renderComponent();

        // Open the menu
        fireEvent.click(screen.getByText('Text'));

        // Type in the filter input
        const filterInput = screen.getByRole('textbox', {name: 'Property type'});
        fireEvent.change(filterInput, {target: {value: 'multi'}});

        // Should only see Multi-select now
        expect(screen.getByText('Multi-select')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
    });

    it('disables non-supported options when ldap-linked', () => {
        renderComponent({...baseField, attrs: {...baseField.attrs, ldap: 'ldapPropName'}});

        // Open the menu
        fireEvent.click(screen.getByText('Text'));

        // Non-text should be disabled
        expect(screen.getByRole('menuitemradio', {name: 'Phone'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'URL'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Select'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Multi-select'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Select'})).toHaveAttribute('aria-disabled', 'true');
    });

    it('disables non-supported options when saml-linked', () => {
        renderComponent({...baseField, attrs: {...baseField.attrs, saml: 'samlPropName'}});

        // Open the menu
        fireEvent.click(screen.getByText('Text'));

        // Non-text should be disabled
        expect(screen.getByRole('menuitemradio', {name: 'Phone'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'URL'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Select'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Multi-select'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Select'})).toHaveAttribute('aria-disabled', 'true');
    });

    it('shows check icon for current type', () => {
        const selectField = {
            ...baseField,
            type: 'select' as const,
            attrs: {
                ...baseField.attrs,
                value_type: '' as const,
            },
        };

        renderComponent(selectField);

        // Open the menu
        fireEvent.click(screen.getByText('Select'));

        // All options should be visible, but Select should have a check
        expect(screen.getByRole('menuitemradio', {name: 'Select'})).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', {name: 'Text'})).toHaveAttribute('aria-checked', 'false');
    });
});
