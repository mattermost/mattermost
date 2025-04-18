// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import UserPropertyValues from './user_properties_values';

describe('UserPropertyValues', () => {
    const baseField: UserPropertyField = {
        id: 'test-id',
        name: 'Test Field',
        type: 'select',
        group_id: 'custom_profile_attributes',
        create_at: 1736541716295,
        delete_at: 0,
        update_at: 0,
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
            options: [
                {id: 'option1', name: 'Option 1'},
                {id: 'option2', name: 'Option 2'},
            ],
        },
    };

    const updateField = jest.fn();

    const renderComponent = (field: UserPropertyField = baseField) => {
        return renderWithContext(
            <UserPropertyValues
                field={field}
                updateField={updateField}
            />,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly for select/multiselect field types', () => {
        renderComponent();

        // Check that both options are displayed
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('renders dash for non-select field types', () => {
        const textField = {
            ...baseField,
            type: 'text' as const,
        };

        renderComponent(textField);

        expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('adds a new option when typing and pressing Enter', async () => {
        renderComponent();

        const input = screen.getByRole('combobox');
        fireEvent.change(input, {target: {value: 'New Option'}});
        fireEvent.keyDown(input, {key: 'Enter'});

        expect(updateField).toHaveBeenCalledWith({
            ...baseField,
            attrs: {
                ...baseField.attrs,
                options: [
                    ...baseField.attrs.options || [],
                    {id: '', name: 'New Option'},
                ],
            },
        });
    });

    it('adds a new option when typing and blurring', async () => {
        renderComponent();

        const input = screen.getByRole('combobox');
        fireEvent.change(input, {target: {value: 'New Option'}});
        fireEvent.blur(input);

        expect(updateField).toHaveBeenCalledWith({
            ...baseField,
            attrs: {
                ...baseField.attrs,
                options: [
                    ...baseField.attrs.options || [],
                    {id: '', name: 'New Option'},
                ],
            },
        });
    });

    it('removes an option when clicking the remove button', async () => {
        renderComponent();

        // Find and click the first remove button (x)
        const removeButtons = screen.getAllByRole('button');
        fireEvent.click(removeButtons[0]);

        expect(updateField).toHaveBeenCalledWith({
            ...baseField,
            attrs: {
                ...baseField.attrs,
                options: [{id: 'option2', name: 'Option 2'}],
            },
        });
    });

    it('shows validation error when trying to add a duplicate option', async () => {
        renderComponent();

        const input = screen.getByRole('combobox');
        fireEvent.change(input, {target: {value: 'Option 1'}}); // This already exists

        // Error message should appear
        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();

        // Pressing Enter shouldn't add the duplicate
        fireEvent.keyDown(input, {key: 'Enter'});
        expect(updateField).not.toHaveBeenCalled();
    });

    it('is disabled when the field is marked for deletion', () => {
        const deletedField = {
            ...baseField,
            delete_at: 123456789,
        };

        renderComponent(deletedField);

        const option = screen.getByText('Option 1');
        expect(option.closest('div[aria-disabled]')).toBeInTheDocument();
    });

    it('shows LDAP sync information when field has LDAP attribute', () => {
        const ldapField = {
            ...baseField,
            attrs: {
                ...baseField.attrs,
                ldap: 'ldapAttribute',
            },
        };

        renderComponent(ldapField);

        // Check that the sync info is displayed
        expect(screen.getByText(/Synced with:/)).toBeInTheDocument();
        const ldapLink = screen.getByText('AD/LDAP: ldapAttribute');
        expect(ldapLink).toBeInTheDocument();

        // Check that the link points to the correct location
        const linkElement = screen.getByTestId(`user-property-field-values__ldap-${ldapField.name}`);
        expect(linkElement).toBeInTheDocument();
        expect(linkElement).toHaveAttribute('href', `/admin_console/authentication/ldap#custom_profile_attribute-${baseField.name}`);
    });

    it('shows SAML sync information when field has SAML attribute', () => {
        const samlField = {
            ...baseField,
            attrs: {
                ...baseField.attrs,
                saml: 'samlAttribute',
            },
        };

        renderComponent(samlField);

        // Check that the sync info is displayed
        expect(screen.getByText(/Synced with:/)).toBeInTheDocument();
        const samlLink = screen.getByText('SAML: samlAttribute');
        expect(samlLink).toBeInTheDocument();

        // Check that the link points to the correct location
        const linkElement = screen.getByTestId(`user-property-field-values__saml-${samlField.name}`);
        expect(linkElement).toBeInTheDocument();
        expect(linkElement).toHaveAttribute('href', `/admin_console/authentication/saml#custom_profile_attribute-${baseField.name}`);
    });

    it('shows both LDAP and SAML sync information when field has both attributes', () => {
        const syncedField = {
            ...baseField,
            attrs: {
                ...baseField.attrs,
                ldap: 'ldapAttribute',
                saml: 'samlAttribute',
            },
        };

        renderComponent(syncedField);

        // Check that the sync info is displayed
        expect(screen.getByText(/Synced with:/)).toBeInTheDocument();

        const ldapLink = screen.getByText('AD/LDAP: ldapAttribute');
        expect(ldapLink).toBeInTheDocument();

        const samlLink = screen.getByText('SAML: samlAttribute');
        expect(samlLink).toBeInTheDocument();

        // Check that both links point to the correct locations
        const ldapLinkElement = screen.getByTestId(`user-property-field-values__ldap-${baseField.name}`);
        expect(ldapLinkElement).toBeInTheDocument();

        const samlLinkElement = screen.getByTestId(`user-property-field-values__ldap-${baseField.name}`);
        expect(samlLinkElement).toBeInTheDocument();
    });
});
