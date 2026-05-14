// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen, within} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {patchChannelPostPropertyField} from 'mattermost-redux/actions/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ManageRow from './manage_row';

jest.mock('mattermost-redux/actions/properties', () => ({
    patchChannelPostPropertyField: jest.fn(() => ({type: 'MOCK_PATCH'})),
}));

const patchMock = patchChannelPostPropertyField as jest.MockedFunction<typeof patchChannelPostPropertyField>;

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Status',
        type: 'text',
        target_id: 'channel-1',
        target_type: 'channel',
        object_type: 'post',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'u1',
        updated_by: 'u1',
        ...overrides,
    };
}

function makeSelectField(options: PropertyFieldOption[]): PropertyField {
    return makeField({
        id: 'fs',
        name: 'Priority',
        type: 'select',
        attrs: {options} as PropertyField['attrs'],
    });
}

describe('components/manage_post_properties_modal/ManageRow', () => {
    beforeEach(() => {
        patchMock.mockClear();
    });

    test('renders read mode by default with name and type label, no inputs', () => {
        const field = makeField({name: 'Status', type: 'text'});

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        // Name is plain text — not an input.
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

        // Type label is rendered (Text).
        expect(screen.getByText(/^Text$/)).toBeInTheDocument();
    });

    test('renders option chips in read mode for select fields', () => {
        const field = makeSelectField([
            {id: 'o1', name: 'Low', color: '#abcdef'},
            {id: 'o2', name: 'High', color: '#fedcba'},
        ]);

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        expect(screen.getByText('Low')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
    });

    test('exposes the edit and delete buttons with accessible names', () => {
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        const editBtn = screen.getByRole('button', {name: /edit f1/i});
        const deleteBtn = screen.getByRole('button', {name: /delete f1/i});

        // Both reachable as native buttons.
        expect(editBtn).toBeEnabled();
        expect(deleteBtn).toBeEnabled();
        expect(editBtn.tagName).toBe('BUTTON');
        expect(deleteBtn.tagName).toBe('BUTTON');
    });

    test('clicking the delete button invokes onDeleteRequest with the field id', () => {
        const onDeleteRequest = jest.fn();
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={onDeleteRequest}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /delete f1/i}));
        expect(onDeleteRequest).toHaveBeenCalledWith('f1');
    });

    test('clicking edit enters edit mode: name Input + type LabeledSelect appear', () => {
        const field = makeField({id: 'f1', name: 'Status', type: 'text'});

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));

        // Name became an input.
        expect(screen.getByLabelText(/^Status$/i)).toHaveValue('Status');

        // Type select is rendered (react-select renders a combobox role).
        expect(screen.getByRole('combobox')).toBeInTheDocument();

        // Save (check) and cancel buttons replace the edit pencil.
        expect(screen.getByRole('button', {name: /save f1/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel edit f1/i})).toBeInTheDocument();
    });

    test('save is disabled when the row is clean', () => {
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        expect(screen.getByRole('button', {name: /save f1/i})).toBeDisabled();
    });

    test('save is disabled when the name is whitespace-only', () => {
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        fireEvent.change(screen.getByLabelText(/^Status$/i), {target: {value: '   '}});

        expect(screen.getByRole('button', {name: /save f1/i})).toBeDisabled();
    });

    test('saving a renamed field dispatches a patch and exits edit mode', () => {
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        fireEvent.change(screen.getByLabelText(/^Status$/i), {target: {value: 'Stage'}});
        fireEvent.click(screen.getByRole('button', {name: /save f1/i}));

        expect(patchMock).toHaveBeenCalledWith('f1', {name: 'Stage'});

        // Back to read mode — edit pencil reappears.
        expect(screen.getByRole('button', {name: /edit f1/i})).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    test('cancelling reverts drafts and exits edit mode without dispatching', () => {
        const field = makeField({id: 'f1', name: 'Status'});

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        fireEvent.change(screen.getByLabelText(/^Status$/i), {target: {value: 'Stage'}});
        fireEvent.click(screen.getByRole('button', {name: /cancel edit f1/i}));

        expect(patchMock).not.toHaveBeenCalled();

        // Read-mode name is still "Status".
        expect(screen.getByText('Status')).toBeInTheDocument();

        // Re-entering edit shows the original value, not the abandoned draft.
        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));
        expect(screen.getByLabelText(/^Status$/i)).toHaveValue('Status');
    });

    test('select field in edit mode shows option Inputs and an Add option button', () => {
        const field = makeSelectField([{id: 'o1', name: 'Low'}]);

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit fs/i}));

        expect(screen.getByLabelText(/option name 1/i)).toHaveValue('Low');
        expect(screen.getByRole('button', {name: /add option/i})).toBeInTheDocument();
    });

    test('saving an option rename dispatches patch with attrs.options', () => {
        const field = makeSelectField([{id: 'o1', name: 'Low'}, {id: 'o2', name: 'High'}]);

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit fs/i}));
        fireEvent.change(screen.getByLabelText(/option name 1/i), {target: {value: 'Minor'}});
        fireEvent.click(screen.getByRole('button', {name: /save fs/i}));

        expect(patchMock).toHaveBeenCalledWith('fs', {
            attrs: expect.objectContaining({
                options: [
                    expect.objectContaining({id: 'o1', name: 'Minor'}),
                    expect.objectContaining({id: 'o2', name: 'High'}),
                ],
            }),
        });
    });

    test('save is disabled for a select with zero options', () => {
        const field = makeSelectField([{id: 'o1', name: 'Low'}]);

        renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit fs/i}));
        fireEvent.click(screen.getByRole('button', {name: /remove option 1/i}));

        expect(screen.getByRole('button', {name: /save fs/i})).toBeDisabled();
    });

    test('changing type to select from text shows an empty options list and disables save until an option is added', () => {
        // Text field — no options.
        const field = makeField({id: 'f1', name: 'Status', type: 'text'});

        const {container} = renderWithContext(
            <ManageRow
                field={field}
                onDeleteRequest={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', {name: /edit f1/i}));

        // No options block yet.
        expect(screen.queryByRole('button', {name: /add option/i})).not.toBeInTheDocument();

        // Open type select and pick Select.
        // react-select renders the input combobox; simplest is to dispatch the change
        // via clicking the option after opening the menu.
        const combobox = screen.getByRole('combobox');
        fireEvent.keyDown(combobox, {key: 'ArrowDown'});

        // Wait for menu — react-select renders options inline once menuIsOpen.
        const selectOption = within(container).getByText(/^Select$/);
        fireEvent.click(selectOption);

        // Options block now visible with Add option.
        expect(screen.getByRole('button', {name: /add option/i})).toBeInTheDocument();

        // Save disabled (no options yet).
        expect(screen.getByRole('button', {name: /save f1/i})).toBeDisabled();
    });
});
