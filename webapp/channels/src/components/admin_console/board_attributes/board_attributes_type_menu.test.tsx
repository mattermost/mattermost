// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {BoardsPropertyField} from '@mattermost/types/properties_board';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SelectType from './board_attributes_type_menu';

function makeField(overrides: Partial<BoardsPropertyField> = {}): BoardsPropertyField {
    return {
        id: 'field-1',
        name: 'My Attribute',
        type: 'text',
        group_id: 'boards',
        object_type: 'post',
        create_at: 1700000000000,
        delete_at: 0,
        update_at: 1700000000000,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: 'system',
        attrs: {sort_order: 0},
        ...overrides,
    } as BoardsPropertyField;
}

describe('SelectType (board attributes type menu)', () => {
    it('renders the current type label on the trigger button', () => {
        renderWithContext(
            <SelectType
                field={makeField({type: 'select'})}
                updateField={jest.fn()}
            />,
        );

        expect(screen.getByTestId('fieldTypeSelectorMenuButton')).toHaveTextContent(/select/i);
    });

    it('disables the trigger button when the field is protected', () => {
        renderWithContext(
            <SelectType
                field={makeField({protected: true})}
                updateField={jest.fn()}
            />,
        );

        expect(screen.getByTestId('fieldTypeSelectorMenuButton')).toBeDisabled();
    });

    it('disables the trigger button when the field is flagged for delete', () => {
        renderWithContext(
            <SelectType
                field={makeField({delete_at: 1700000099999})}
                updateField={jest.fn()}
            />,
        );

        expect(screen.getByTestId('fieldTypeSelectorMenuButton')).toBeDisabled();
    });

    it('exposes all five known field types when the menu opens', async () => {
        renderWithContext(
            <SelectType
                field={makeField({type: 'text'})}
                updateField={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByTestId('fieldTypeSelectorMenuButton'));

        // The menu surfaces all the supported types
        expect(screen.getByRole('menuitemradio', {name: /text/i})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: /^select$/i})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: /multi-select/i})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: /date/i})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: /user/i})).toBeInTheDocument();
    });

    it('marks the current type as checked', async () => {
        renderWithContext(
            <SelectType
                field={makeField({type: 'select'})}
                updateField={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByTestId('fieldTypeSelectorMenuButton'));

        const selectItem = screen.getByRole('menuitemradio', {name: /^select$/i});
        expect(selectItem).toHaveAttribute('aria-checked', 'true');

        const textItem = screen.getByRole('menuitemradio', {name: /text/i});
        expect(textItem).toHaveAttribute('aria-checked', 'false');
    });

    it('calls updateField with the chosen type when a menu item is selected', async () => {
        const updateField = jest.fn();
        const field = makeField({type: 'text'});

        renderWithContext(
            <SelectType
                field={field}
                updateField={updateField}
            />,
        );

        await userEvent.click(screen.getByTestId('fieldTypeSelectorMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: /^select$/i}));

        expect(updateField).toHaveBeenCalledTimes(1);
        expect(updateField).toHaveBeenCalledWith({...field, type: 'select'});
    });
});
