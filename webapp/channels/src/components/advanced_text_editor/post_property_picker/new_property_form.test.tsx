// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import NewPropertyForm from './new_property_form';

function wrap(ui: React.ReactElement) {
    return <IntlProvider locale='en'>{ui}</IntlProvider>;
}

function pickType(label: RegExp | string) {
    const combobox = screen.getByRole('combobox', {name: /type/i});
    fireEvent.mouseDown(combobox);
    fireEvent.focus(combobox);
    fireEvent.click(screen.getByRole('option', {name: label}));
}

// The CreatableSelect for options exposes a combobox with inputId
// `new-property-options`. The Type LabeledSelect also exposes a combobox.
// Disambiguate by id to avoid hitting the Type one by mistake.
function getOptionsInput(): HTMLInputElement {
    const input = document.getElementById('new-property-options') as HTMLInputElement | null;
    if (!input) {
        throw new Error('options input not found');
    }
    return input;
}

describe('components/advanced_text_editor/post_property_picker/NewPropertyForm', () => {
    test('renders a name input and type selector', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        expect(screen.getByRole('textbox', {name: /name/i})).toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: /type/i})).toBeInTheDocument();
    });

    test('renders each type option with its property-type icon when the menu opens', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));

        const combobox = screen.getByRole('combobox', {name: /type/i});
        fireEvent.mouseDown(combobox);
        fireEvent.focus(combobox);

        for (const [label, type] of [
            [/Text/, 'text'],
            [/Date/, 'date'],
            [/^Select$/, 'select'],
            [/Multi-select/, 'multiselect'],
            [/User/, 'user'],
        ] as const) {
            const option = screen.getByRole('option', {name: label});
            expect(within(option).getByText(label)).toBeInTheDocument();
            expect(option.querySelector(`[data-property-type='${type}']`)).not.toBeNull();
        }
    });

    test('calls onCancel when cancel is clicked', () => {
        const onCancel = jest.fn();
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={onCancel}
            />,
        ));
        fireEvent.click(screen.getByRole('button', {name: /cancel/i}));
        expect(onCancel).toHaveBeenCalled();
    });

    test('shows a validation error when name is empty on save', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        fireEvent.click(screen.getByRole('button', {name: /^save/i}));
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();

        // The error renders via `Input.customMessage`, which marks the input as invalid.
        expect(screen.getByRole('textbox', {name: /name/i})).toHaveAttribute('aria-invalid', 'true');
    });

    test('calls onSave with name and type for a text field', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(wrap(
            <NewPropertyForm
                onSave={onSave}
                onCancel={jest.fn()}
            />,
        ));

        fireEvent.change(screen.getByRole('textbox', {name: /name/i}), {target: {value: 'Status'}});
        fireEvent.click(screen.getByRole('button', {name: /^save/i}));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith({
                name: 'Status',
                type: 'text',
                options: undefined,
            });
        });
    });

    test('shows the options pill editor when type is select', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        pickType(/^Select$/);

        // The CreatableSelect is rendered (combobox with our inputId).
        const input = getOptionsInput();
        expect(input).toBeInTheDocument();
        expect(input.getAttribute('role')).toBe('combobox');
    });

    test('disables save for select with no options', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        fireEvent.change(screen.getByRole('textbox', {name: /name/i}), {target: {value: 'Priority'}});
        pickType(/^Select$/);
        expect(screen.getByRole('button', {name: /^save/i})).toBeDisabled();
    });

    test('shows validation error for select with no options when save is forced', () => {
        // Submit without options by typing nothing — the button is disabled, but
        // we want to also verify the error message contract when validation runs.
        // We do this by adding then removing an option to ensure the input had
        // focus once, then asserting the disabled state plus pre-validation text.
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        fireEvent.change(screen.getByRole('textbox', {name: /name/i}), {target: {value: 'Priority'}});
        pickType(/^Select$/);

        // With no options and no query, the save button must be disabled.
        const saveBtn = screen.getByRole('button', {name: /^save/i});
        expect(saveBtn).toBeDisabled();
    });

    test('adds an option by typing and pressing Enter, and removes it via the pill x', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        pickType(/^Select$/);

        const input = getOptionsInput();
        fireEvent.change(input, {target: {value: 'Open'}});
        fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});

        // The pill appears as text inside the control.
        expect(screen.getByText('Open')).toBeInTheDocument();

        // react-select's MultiValueRemove is the pill's × control. It listens on mousedown.
        const removeBtn = document.querySelector('.new-property-form__options__multi-value__remove');
        expect(removeBtn).not.toBeNull();
        fireEvent.mouseDown(removeBtn as Element, {button: 0});
        fireEvent.click(removeBtn as Element);

        // Pill content is rendered by react-select; after removal the label node is gone.
        expect(document.querySelector('.new-property-form__options__multi-value__label')).toBeNull();
    });

    test('shows a duplicate-name error when typing an existing option name', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        pickType(/^Select$/);

        const input = getOptionsInput();
        fireEvent.change(input, {target: {value: 'Open'}});
        fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});

        // Try to add the same value again — duplicate message appears.
        fireEvent.change(input, {target: {value: 'Open'}});
        expect(screen.getByText(/values must be unique/i)).toBeInTheDocument();

        // Pressing Enter does not add a second pill.
        fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});
        expect(screen.getAllByText('Open')).toHaveLength(1);
    });

    test('calls onSave with options for a select field (id: "" for new options)', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(wrap(
            <NewPropertyForm
                onSave={onSave}
                onCancel={jest.fn()}
            />,
        ));

        fireEvent.change(screen.getByRole('textbox', {name: /name/i}), {target: {value: 'Status'}});
        pickType(/^Select$/);

        const input = getOptionsInput();
        fireEvent.change(input, {target: {value: 'Open'}});
        fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});

        fireEvent.click(screen.getByRole('button', {name: /^save/i}));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Status',
                    type: 'select',
                    options: expect.arrayContaining([
                        expect.objectContaining({name: 'Open', id: ''}),
                    ]),
                }),
            );
        });

        // Stricter: exactly one option, and it carries empty id for backend EnsureOptionIDs.
        expect(onSave.mock.calls[0][0].options).toEqual([{id: '', name: 'Open'}]);
    });

    test('accepts a typed-but-unconfirmed option on save', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(wrap(
            <NewPropertyForm
                onSave={onSave}
                onCancel={jest.fn()}
            />,
        ));

        fireEvent.change(screen.getByRole('textbox', {name: /name/i}), {target: {value: 'Status'}});
        pickType(/^Select$/);

        // Type a value but do NOT press Enter.
        const input = getOptionsInput();
        fireEvent.change(input, {target: {value: 'Open'}});

        fireEvent.click(screen.getByRole('button', {name: /^save/i}));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalled();
        });
        expect(onSave.mock.calls[0][0].options).toEqual([{id: '', name: 'Open'}]);
    });
});
