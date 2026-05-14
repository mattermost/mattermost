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

    test('shows an options section when type is select', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        pickType(/^Select$/);
        expect(screen.getByRole('button', {name: /add option/i})).toBeInTheDocument();
    });

    test('shows validation error for select with no options', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        fireEvent.change(screen.getByRole('textbox', {name: /name/i}), {target: {value: 'Priority'}});
        pickType(/^Select$/);
        fireEvent.click(screen.getByRole('button', {name: /^save/i}));
        expect(screen.getByText(/at least one option/i)).toBeInTheDocument();
    });

    test('adds and removes options', () => {
        render(wrap(
            <NewPropertyForm
                onSave={jest.fn()}
                onCancel={jest.fn()}
            />,
        ));
        pickType(/^Select$/);
        fireEvent.click(screen.getByRole('button', {name: /add option/i}));

        const optionInputs = screen.getAllByRole('textbox', {name: /option name/i});
        expect(optionInputs).toHaveLength(1);
        fireEvent.change(optionInputs[0], {target: {value: 'Open'}});

        fireEvent.click(screen.getByRole('button', {name: /remove option/i}));
        expect(screen.queryAllByRole('textbox', {name: /option name/i})).toHaveLength(0);
    });

    test('calls onSave with options for a select field', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(wrap(
            <NewPropertyForm
                onSave={onSave}
                onCancel={jest.fn()}
            />,
        ));

        fireEvent.change(screen.getByRole('textbox', {name: /name/i}), {target: {value: 'Status'}});
        pickType(/^Select$/);
        fireEvent.click(screen.getByRole('button', {name: /add option/i}));
        fireEvent.change(screen.getAllByRole('textbox', {name: /option name/i})[0], {target: {value: 'Open'}});
        fireEvent.click(screen.getByRole('button', {name: /^save/i}));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Status',
                    type: 'select',
                    options: expect.arrayContaining([
                        expect.objectContaining({name: 'Open'}),
                    ]),
                }),
            );
        });
    });
});
