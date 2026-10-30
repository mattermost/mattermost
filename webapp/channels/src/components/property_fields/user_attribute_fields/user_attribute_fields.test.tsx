// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';

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
const OPTIONS = [{id: 'opt-1', name: 'One'}, {id: 'opt-2', name: 'Two'}];
const COMBOBOX_ID = 'user-detail-custom-attribute-combobox-field-1';

const chipLabels = (root: HTMLElement) => Array.from(root.querySelectorAll('[data-chip]')).map((chip) => chip.textContent);

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
        const field = buildField({type: 'select'}, {options: OPTIONS});
        const {onChange} = renderFields({fields: [field], values: {'field-1': 'opt-1'}});

        const input = screen.getByRole('combobox', {name: 'department'});
        expect(input).toHaveValue('One');
        await userEvent.click(input);
        await userEvent.click(screen.getByRole('option', {name: 'Two'}));

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

    test.each([
        ['select', 'opt-1'],
        ['multiselect', ['opt-1']],
    ] as const)('shows an error for a %s field and links it to the input', (type, value) => {
        const field = buildField({type}, {options: [{id: 'opt-1', name: 'One'}]});
        const values = {'field-1': typeof value === 'string' ? value : [...value]};
        const {unmount} = renderFields({fields: [field], values, errors: {'field-1': 'Bad'}});

        const input = screen.getByRole('combobox');
        expect(screen.getByRole('alert')).toHaveTextContent('Bad');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAccessibleDescription('Bad');
        unmount();

        renderFields({fields: [field], values});
        expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');
        expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-describedby');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

    describe('select and multiselect comboboxes', () => {
        test.each(['select', 'multiselect'] as const)('renders a %s as a combobox in a div root named by a label', (type) => {
            renderFields({fields: [buildField({type}, {options: OPTIONS})]});

            const root = screen.getByTestId('user-detail-custom-attribute-label-field-1');
            const input = screen.getByRole('combobox', {name: 'department'});
            expect(root.tagName).toBe('DIV');
            expect(root).toContainElement(input);
            expect(input).toHaveAttribute('id', COMBOBOX_ID);
            expect(input).toHaveAttribute('data-testid', COMBOBOX_ID);

            const labels = root.querySelectorAll('label');
            expect(labels).toHaveLength(1);
            expect(labels[0]).toHaveAttribute('for', COMBOBOX_ID);
            expect(labels[0]).toHaveTextContent('department');

            const wrapper = input.closest('.UserAttributeField__combobox');
            expect(wrapper).toHaveAttribute('role', 'presentation');
            expect(root.children[0]).toBe(labels[0]);
            expect(root.children[1]).toBe(wrapper);
        });

        test.each([
            ['text', buildField({id: 'text'}), 'textbox'],
            ['rank', buildField({id: 'rank', type: 'rank'}, {options: [{id: 'opt-1', name: 'Low', rank: 1}]}), 'button'],
            ['omitted select', buildField({id: 'omitted', type: 'select'}, {options_omitted: true}), 'textbox'],
            ['omitted multiselect', buildField({id: 'omitted-multi', type: 'multiselect'}, {options_omitted: true}), 'textbox'],
        ] as const)('names a %s field the same way: a div root whose first child labels the control', (_, field, role) => {
            renderFields({fields: [field]});

            const root = screen.getByTestId(`user-detail-custom-attribute-label-${field.id}`);
            const control = screen.getByRole(role, {name: 'department'});
            expect(root.tagName).toBe('DIV');
            expect(root.children[0].tagName).toBe('LABEL');
            expect(root.children[0]).toHaveAttribute('for', control.id);
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        });

        test('clicking a multiselect name focuses its input without removing a chip', async () => {
            const user = userEvent.setup();
            const field = buildField({type: 'multiselect'}, {options: OPTIONS});
            const {onChange} = renderFields({fields: [field], values: {'field-1': ['opt-1']}});
            const root = screen.getByTestId('user-detail-custom-attribute-label-field-1');

            await user.click(screen.getByText('department'));

            expect(screen.getByRole('combobox', {name: 'department'})).toHaveFocus();
            expect(chipLabels(root)).toEqual(['One']);
            expect(onChange).not.toHaveBeenCalled();
        });

        test.each([
            ['select', 'opt-1'],
            ['multiselect', ['opt-1']],
        ] as const)('Enter on a closed %s inside a form does not submit it', async (type, value) => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            renderWithContext(
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSubmit();
                    }}
                >
                    <UserAttributeFields
                        fields={[
                            buildField({type}, {options: OPTIONS}),
                            buildField({id: 'field-2', name: 'title'}),
                        ]}
                        values={{'field-1': typeof value === 'string' ? value : [...value]}}
                        errors={{}}
                        onChange={jest.fn()}
                        canEditAdminManaged={true}
                    />
                    <button type='submit'/>
                </form>,
                {plugins: {plugins: {}}},
            );

            const combobox = screen.getByRole('combobox', {name: 'department'});
            act(() => combobox.focus());
            expect(combobox).toHaveAttribute('aria-expanded', 'false');
            await user.keyboard('{Enter}');
            expect(onSubmit).not.toHaveBeenCalled();

            // The same Enter in a text field submits, so the first half isn't vacuous.
            act(() => screen.getByRole('textbox', {name: 'title'}).focus());
            await user.keyboard('{Enter}');
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        test('a locked select hides its clear button and a locked multiselect its chip remove buttons', () => {
            renderFields({
                fields: [
                    buildField({id: 'single', type: 'select'}, {options: OPTIONS, protected: true}),
                    buildField({id: 'multi', type: 'multiselect'}, {options: OPTIONS, protected: true}),
                ],
                values: {single: 'opt-1', multi: ['opt-1', 'opt-2']},
            });

            const single = screen.getByTestId('user-detail-custom-attribute-combobox-single');
            expect(single).toBeDisabled();
            expect(single).toHaveValue('One');
            expect(screen.queryByTestId('user-detail-custom-attribute-combobox-single-clear')).not.toBeInTheDocument();

            const multiRoot = screen.getByTestId('user-detail-custom-attribute-label-multi');
            expect(screen.getByTestId('user-detail-custom-attribute-combobox-multi')).toBeDisabled();
            expect(chipLabels(multiRoot)).toEqual(['One', 'Two']);
            expect(multiRoot.querySelector('[data-chip-remove]')).toBeNull();
        });

        test('a disabled list hides the clear and chip remove buttons of unlocked fields', () => {
            const fields = [
                buildField({id: 'single', type: 'select'}, {options: OPTIONS}),
                buildField({id: 'multi', type: 'multiselect'}, {options: OPTIONS}),
            ];
            const values = {single: 'opt-1', multi: ['opt-1', 'opt-2']};
            const {unmount} = renderFields({fields, values});
            expect(screen.getByTestId('user-detail-custom-attribute-combobox-single-clear')).toBeInTheDocument();
            expect(screen.getByTestId('user-detail-custom-attribute-label-multi').querySelector('[data-chip-remove]')).toBeInTheDocument();
            unmount();

            renderFields({fields, values, disabled: true});

            expect(screen.getByTestId('user-detail-custom-attribute-combobox-single')).toBeDisabled();
            expect(screen.queryByTestId('user-detail-custom-attribute-combobox-single-clear')).not.toBeInTheDocument();

            const multiRoot = screen.getByTestId('user-detail-custom-attribute-label-multi');
            expect(screen.getByTestId('user-detail-custom-attribute-combobox-multi')).toBeDisabled();
            expect(chipLabels(multiRoot)).toEqual(['One', 'Two']);
            expect(multiRoot.querySelector('[data-chip-remove]')).toBeNull();
        });

        test('shows a stale select id as is and clears it to an empty string', async () => {
            const user = userEvent.setup();
            const field = buildField({type: 'select'}, {options: OPTIONS});
            const {onChange} = renderFields({fields: [field], values: {'field-1': 'gone'}});

            expect(screen.getByRole('combobox', {name: 'department'})).toHaveValue('gone');
            await user.click(screen.getByTestId(`${COMBOBOX_ID}-clear`));

            expect(onChange).toHaveBeenCalledWith('field-1', '');
        });

        test('shows the first id of an array value on a select', () => {
            const field = buildField({type: 'select'}, {options: OPTIONS});
            renderFields({fields: [field], values: {'field-1': ['opt-2', 'opt-1']}});

            expect(screen.getByRole('combobox', {name: 'department'})).toHaveValue('Two');
        });

        test('shows a lone-string multiselect value as one chip and keeps it when adding', async () => {
            const user = userEvent.setup();
            const field = buildField({type: 'multiselect'}, {options: OPTIONS});
            const {onChange} = renderFields({fields: [field], values: {'field-1': 'opt-1'}});

            expect(chipLabels(screen.getByTestId('user-detail-custom-attribute-label-field-1'))).toEqual(['One']);
            await user.click(screen.getByRole('combobox', {name: 'department'}));
            await user.click(screen.getByRole('option', {name: 'Two'}));

            expect(onChange).toHaveBeenCalledWith('field-1', ['opt-1', 'opt-2']);
        });

        test.each([
            ['select', 'Select an option'],
            ['multiselect', 'Select options...'],
        ] as const)('gives an empty %s the "%s" placeholder', (type, placeholder) => {
            renderFields({fields: [buildField({type}, {options: OPTIONS})]});

            expect(screen.getByRole('combobox', {name: 'department'})).toHaveAttribute('placeholder', placeholder);
        });

        test('uses the bot prefix for the combobox id and label', () => {
            renderFields({testIdPrefix: 'bot-attribute', fields: [buildField({type: 'select'}, {options: OPTIONS})]});

            const root = screen.getByTestId('bot-attribute-label-field-1');
            const input = screen.getByTestId('bot-attribute-combobox-field-1');
            expect(input).toHaveAttribute('id', 'bot-attribute-combobox-field-1');
            expect(root).toContainElement(input);
            expect(root.querySelector('label')).toHaveAttribute('for', 'bot-attribute-combobox-field-1');
        });
    });
});
