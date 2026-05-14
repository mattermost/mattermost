// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import NewPropertyForm from './new_property_form';

function wrap(ui: React.ReactElement) {
    return <IntlProvider locale='en'>{ui}</IntlProvider>;
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
        fireEvent.change(screen.getByRole('combobox', {name: /type/i}), {target: {value: 'select'}});
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
        fireEvent.change(screen.getByRole('combobox', {name: /type/i}), {target: {value: 'select'}});
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
        fireEvent.change(screen.getByRole('combobox', {name: /type/i}), {target: {value: 'select'}});
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
        fireEvent.change(screen.getByRole('combobox', {name: /type/i}), {target: {value: 'select'}});
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
