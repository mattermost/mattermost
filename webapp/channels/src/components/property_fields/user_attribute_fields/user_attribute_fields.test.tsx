// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import UserAttributeFields from './user_attribute_fields';
import type {UserAttributeFieldsProps} from './user_attribute_fields';

const buildField = (overrides: Partial<UserPropertyField> = {}, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
    id: 'field-1',
    name: 'department',
    type: 'text',
    group_id: 'custom_profile_attributes',
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
    target_id: '',
    target_type: '',
    object_type: 'user',
    ...overrides,
    attrs: {sort_order: 0, visibility: 'when_set', value_type: '', ...attrs},
});

const ADMIN_MANAGED = 'This field can only be changed by an administrator.';

describe('UserAttributeFields', () => {
    const renderFields = (props: Partial<UserAttributeFieldsProps> = {}) => {
        const onChange = jest.fn();
        const result = renderWithContext(
            <UserAttributeFields
                fields={[buildField()]}
                values={{}}
                errors={{}}
                onChange={onChange}
                canEditAdminManaged={true}
                {...props}
            />,
            {plugins: {plugins: {}}},
        );
        return {...result, onChange};
    };

    test('uses the System Console test id by default and honors testIdPrefix', () => {
        const {unmount} = renderFields();
        expect(screen.getByTestId('user-detail-custom-attribute-label-field-1')).toBeInTheDocument();
        expect(screen.getByTestId('user-detail-custom-attribute-list')).toBeInTheDocument();
        unmount();

        renderFields({testIdPrefix: 'bot-attribute', onRemove: jest.fn()});
        expect(screen.getByTestId('bot-attribute-label-field-1')).toBeInTheDocument();
        expect(screen.getByTestId('bot-attribute-list')).toBeInTheDocument();
        expect(screen.getByTestId('bot-attribute-remove-field-1')).toBeInTheDocument();
        expect(screen.queryByTestId('user-detail-custom-attribute-label-field-1')).not.toBeInTheDocument();
    });

    test('renders fields in the order given with their values and labels', () => {
        renderFields({
            fields: [
                buildField({id: 'b', name: 'b_name'}, {display_name: 'Beta'}),
                buildField({id: 'a', name: 'a_name'}, {display_name: 'Alpha'}),
            ],
            values: {a: 'first', b: 'second'},
        });

        const textboxes = screen.getAllByRole('textbox');
        expect(textboxes.map((input) => (input as HTMLInputElement).value)).toEqual(['second', 'first']);
        expect(screen.getByRole('textbox', {name: 'Alpha'})).toHaveValue('first');
        expect(screen.getByRole('textbox', {name: 'Beta'})).toHaveValue('second');
    });

    test('calls onChange with the field id and value', () => {
        const {onChange} = renderFields();

        fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Eng'}});

        expect(onChange).toHaveBeenCalledWith('field-1', 'Eng');
    });

    test('calls onChange with the option id for a select field', async () => {
        const field = buildField({type: 'select'}, {options: [{id: 'opt-1', name: 'One'}, {id: 'opt-2', name: 'Two'}]});
        const {onChange} = renderFields({fields: [field], values: {'field-1': 'opt-1'}});

        expect(screen.getByRole('combobox')).toHaveValue('opt-1');
        await userEvent.selectOptions(screen.getByRole('combobox'), 'Two');

        expect(onChange).toHaveBeenCalledWith('field-1', 'opt-2');
    });

    test('renders the trash button only when onRemove is set and the row is removable', async () => {
        const {unmount} = renderFields();
        expect(screen.queryByTestId('user-detail-custom-attribute-remove-field-1')).not.toBeInTheDocument();
        unmount();

        const notRemovable = renderFields({onRemove: jest.fn(), isRemovable: () => false});
        expect(screen.queryByTestId('user-detail-custom-attribute-remove-field-1')).not.toBeInTheDocument();
        notRemovable.unmount();

        const onRemove = jest.fn();
        renderFields({onRemove});
        const trash = screen.getByRole('button', {name: 'Remove department'});
        expect(trash).toHaveAttribute('data-testid', 'user-detail-custom-attribute-remove-field-1');

        await userEvent.click(trash);
        expect(onRemove).toHaveBeenCalledWith('field-1');
    });

    test('names the trash button with the display name when set', () => {
        renderFields({fields: [buildField({}, {display_name: 'Team'})], onRemove: jest.fn()});

        expect(screen.getByRole('button', {name: 'Remove Team'})).toBeInTheDocument();
    });

    test('hides the trash button for a locked field even if isRemovable is true', () => {
        renderFields({
            fields: [
                buildField({id: 'protected'}, {protected: true}),
                buildField({id: 'synced'}, {ldap: 'dept'}),
                buildField({id: 'admin'}, {managed: 'admin'}),
                buildField({id: 'open'}),
            ],
            onRemove: jest.fn(),
            isRemovable: () => true,
            canEditAdminManaged: false,
        });

        expect(screen.queryByTestId('user-detail-custom-attribute-remove-protected')).not.toBeInTheDocument();
        expect(screen.queryByTestId('user-detail-custom-attribute-remove-synced')).not.toBeInTheDocument();
        expect(screen.queryByTestId('user-detail-custom-attribute-remove-admin')).not.toBeInTheDocument();
        expect(screen.getByTestId('user-detail-custom-attribute-remove-open')).toBeInTheDocument();
    });

    test('wraps the field in a row only when there is a trailing element', () => {
        const {unmount} = renderFields();
        const bare = screen.getByTestId('user-detail-custom-attribute-label-field-1');
        expect(bare.parentElement).toHaveClass('UserAttributeFields');
        unmount();

        renderFields({onRemove: jest.fn()});
        const label = screen.getByTestId('user-detail-custom-attribute-label-field-1');
        expect(label.parentElement).toHaveClass('UserAttributeField__row');
        expect(label.querySelector('button')).toBeNull();
        expect(screen.getByRole('textbox', {name: 'department'})).toBeInTheDocument();
    });

    test('shows an error for a text field and marks the input invalid', () => {
        renderFields({errors: {'field-1': 'Bad'}});

        expect(screen.getByRole('alert')).toHaveTextContent('Bad');
        expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('textbox')).toHaveClass('error');
    });

    test('shows an error for a select field and links it to the control', () => {
        const field = buildField({type: 'select'}, {options: [{id: 'opt-1', name: 'One'}]});
        const {unmount} = renderFields({fields: [field], errors: {'field-1': 'Bad'}});

        const select = screen.getByRole('combobox');
        expect(screen.getByRole('alert')).toHaveTextContent('Bad');
        expect(select).toHaveAttribute('aria-invalid', 'true');
        expect(select).toHaveAccessibleDescription('Bad');
        unmount();

        renderFields({fields: [field]});
        expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');
        expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-describedby');
    });

    test('shows an error for a rank field and links it to the menu button', () => {
        const field = buildField({type: 'rank'}, {options: [{id: 'opt-1', name: 'Low', rank: 1}, {id: 'opt-2', name: 'High', rank: 2}]});
        const {unmount} = renderFields({fields: [field], values: {'field-1': 'opt-1'}, errors: {'field-1': 'Bad'}});

        expect(screen.getByRole('alert')).toHaveTextContent('Bad');
        expect(screen.getByTestId('cpa-rank-select-field-1')).toHaveAccessibleDescription('Bad');
        unmount();

        renderFields({fields: [field], values: {'field-1': 'opt-1'}});
        expect(screen.getByTestId('cpa-rank-select-field-1')).not.toHaveAttribute('aria-describedby');
    });

    test('shows an error for a multiselect field and marks the input invalid', () => {
        const field = buildField({type: 'multiselect'}, {options: [{id: 'opt-1', name: 'One'}]});
        const {unmount} = renderFields({fields: [field], values: {'field-1': ['opt-1']}, errors: {'field-1': 'Bad'}});

        const input = screen.getByRole('combobox');
        expect(screen.getByRole('alert')).toHaveTextContent('Bad');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-errormessage', 'field-1-error');
        expect(screen.getByText('One')).toBeInTheDocument();
        unmount();

        renderFields({fields: [field], values: {'field-1': ['opt-1']}});
        expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-errormessage');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('renders no error element without an error', () => {
        renderFields({errors: {'field-1': undefined}});

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
    });

    test('locks an admin-managed field without canEditAdminManaged and explains why', () => {
        const field = buildField({}, {managed: 'admin'});
        const {unmount} = renderFields({fields: [field], canEditAdminManaged: false});
        expect(screen.getByRole('textbox')).toBeDisabled();
        expect(screen.getByText(ADMIN_MANAGED)).toBeInTheDocument();
        unmount();

        renderFields({fields: [field], canEditAdminManaged: true});
        expect(screen.getByRole('textbox')).toBeEnabled();
        expect(screen.queryByText(ADMIN_MANAGED)).not.toBeInTheDocument();
    });

    test('shows the synced indicator instead of the admin message for a synced admin-managed field', () => {
        renderFields({fields: [buildField({}, {managed: 'admin', ldap: 'department'})], canEditAdminManaged: false});

        expect(screen.getByRole('textbox')).toBeDisabled();
        expect(screen.getByText(/Synced with:/)).toBeInTheDocument();
        expect(screen.queryByText(ADMIN_MANAGED)).not.toBeInTheDocument();
    });

    test('shows the omitted-options value as a disabled id input', () => {
        const field = buildField({type: 'select'}, {options_omitted: true});
        renderFields({fields: [field], values: {'field-1': 'opt-9'}});

        expect(screen.getByRole('textbox')).toBeDisabled();
        expect(screen.getByRole('textbox')).toHaveValue('opt-9');
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByText('This field has too many options to be edited here.')).toBeInTheDocument();
    });

    test('disables controls while disabled', () => {
        renderFields({disabled: true, onRemove: jest.fn()});

        expect(screen.getByRole('textbox')).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Remove department'})).toBeDisabled();
    });

    test('renders an empty list without fields', () => {
        renderFields({fields: []});

        expect(screen.getByTestId('user-detail-custom-attribute-list')).toBeEmptyDOMElement();
    });
});
