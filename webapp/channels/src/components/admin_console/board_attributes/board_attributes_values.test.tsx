// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {BoardPropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import BoardAttributesValues from './board_attributes_values';
import {isPendingId, ValidationWarningOptionsUnique} from './board_attributes_utils';

function makeField(overrides: Partial<BoardPropertyField> = {}): BoardPropertyField {
    return {
        id: 'field-1',
        name: 'Status',
        type: 'select',
        group_id: 'boards',
        object_type: 'post',
        create_at: 1700000000000,
        delete_at: 0,
        update_at: 1700000000000,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: 'system',
        attrs: {
            sort_order: 0,
            options: [],
        },
        ...overrides,
    } as BoardPropertyField;
}

describe('BoardAttributesValues', () => {
    it('renders an em-dash placeholder for user-typed fields (no options to manage)', () => {
        const field = makeField({type: 'user', attrs: {sort_order: 0}});
        renderWithContext(
            <BoardAttributesValues
                field={field}
                updateField={jest.fn()}
            />,
        );

        // Em-dash is rendered when field type doesn't support options
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders an em-dash placeholder for text-typed fields', () => {
        const field = makeField({type: 'text', attrs: {sort_order: 0}});
        renderWithContext(
            <BoardAttributesValues
                field={field}
                updateField={jest.fn()}
            />,
        );

        expect(screen.getByText('—')).toBeInTheDocument();
    });

    describe('protected (system) select fields', () => {
        const protectedField = makeField({
            protected: true,
            attrs: {
                sort_order: 0,
                options: [
                    {id: 'opt-1', name: 'Todo'},
                    {id: 'opt-2', name: 'In Progress'},
                    {id: 'opt-3', name: 'Complete'},
                ],
            },
        });

        it('renders a read-only chip per option', () => {
            renderWithContext(
                <BoardAttributesValues
                    field={protectedField}
                    updateField={jest.fn()}
                />,
            );

            const readonly = screen.getByTestId('property-values-readonly');
            expect(readonly).toBeInTheDocument();
            expect(readonly).toHaveTextContent('Todo');
            expect(readonly).toHaveTextContent('In Progress');
            expect(readonly).toHaveTextContent('Complete');
        });

        it('does NOT render the editable container or Add button', () => {
            renderWithContext(
                <BoardAttributesValues
                    field={protectedField}
                    updateField={jest.fn()}
                />,
            );

            expect(screen.queryByTestId('property-values-input')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /add value/i})).not.toBeInTheDocument();
        });
    });

    describe('editable select fields', () => {
        it('renders an editable container with one chip per option', () => {
            const field = makeField({
                attrs: {
                    sort_order: 0,
                    options: [
                        {id: 'opt-a', name: 'Low'},
                        {id: 'opt-b', name: 'High'},
                    ],
                },
            });
            renderWithContext(
                <BoardAttributesValues
                    field={field}
                    updateField={jest.fn()}
                />,
            );

            const container = screen.getByTestId('property-values-input');
            expect(container).toBeInTheDocument();
            expect(container).toHaveTextContent('Low');
            expect(container).toHaveTextContent('High');
        });

        it('renders an Add button when editable', () => {
            renderWithContext(
                <BoardAttributesValues
                    field={makeField()}
                    updateField={jest.fn()}
                />,
            );

            expect(screen.getByRole('button', {name: /add value/i})).toBeInTheDocument();
        });

        it('appends a new option with a pending id when Add is clicked', async () => {
            const updateField = jest.fn();
            const field = makeField({
                attrs: {
                    sort_order: 0,
                    options: [{id: 'existing', name: 'Existing'}],
                },
            });

            renderWithContext(
                <BoardAttributesValues
                    field={field}
                    updateField={updateField}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: /add value/i}));

            expect(updateField).toHaveBeenCalledTimes(1);
            const next = updateField.mock.calls[0][0] as BoardPropertyField;
            const options = next.attrs.options ?? [];
            expect(options).toHaveLength(2);

            // Existing option is preserved
            expect(options[0]).toEqual({id: 'existing', name: 'Existing'});

            // New option got a pending id (not '', not a duplicate of the existing id)
            const added = options[1];
            expect(isPendingId(added.id)).toBe(true);
            expect(added.id).not.toBe('');
            expect(added.id).not.toBe('existing');
        });

        it('generates a unique default name for new options that does not collide with siblings', async () => {
            const updateField = jest.fn();
            const field = makeField({
                attrs: {
                    sort_order: 0,
                    options: [
                        {id: '1', name: 'Option 1'},
                        {id: '2', name: 'Option 2'},
                    ],
                },
            });

            renderWithContext(
                <BoardAttributesValues
                    field={field}
                    updateField={updateField}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: /add value/i}));

            const next = updateField.mock.calls[0][0] as BoardPropertyField;
            const added = (next.attrs.options ?? []).at(-1) as PropertyFieldOption;

            // First "Option 1" / "Option 2" are taken; the next one available is "Option 3"
            expect(added.name).toBe('Option 3');
        });

        it('renders chips with stable data-flip-key attributes (used by FLIP animation)', () => {
            const field = makeField({
                attrs: {
                    sort_order: 0,
                    options: [
                        {id: 'opt-a', name: 'A'},
                        {id: 'opt-b', name: 'B'},
                    ],
                },
            });

            renderWithContext(
                <BoardAttributesValues
                    field={field}
                    updateField={jest.fn()}
                />,
            );

            const container = screen.getByTestId('property-values-input');
            // Two chips, each with a data-flip-key matching its option id
            expect(container.querySelector('[data-flip-key="opt-a"]')).toBeInTheDocument();
            expect(container.querySelector('[data-flip-key="opt-b"]')).toBeInTheDocument();
        });

        it('renders the unique-options validation warning when passed via the warning prop', () => {
            const field = makeField({
                attrs: {
                    sort_order: 0,
                    options: [
                        {id: '1', name: 'Same'},
                        {id: '2', name: 'Same'},
                    ],
                },
            });

            renderWithContext(
                <BoardAttributesValues
                    field={field}
                    updateField={jest.fn()}
                    warning={ValidationWarningOptionsUnique}
                />,
            );

            // The exact copy comes from i18n; just confirm the warning surface renders
            // by checking that container holds something beyond the chips.
            expect(screen.getByTestId('property-values-input')).toBeInTheDocument();

            // Look for the warning text via its i18n default (matches the component)
            expect(screen.getByText(/values must be unique/i)).toBeInTheDocument();
        });
    });
});
