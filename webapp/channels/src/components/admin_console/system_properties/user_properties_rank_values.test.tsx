// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import UserPropertyRankValues from './user_properties_rank_values';

describe('UserPropertyRankValues', () => {
    const baseField = (): UserPropertyField => ({
        id: 'field-id',
        name: 'clearance',
        type: 'rank',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        delete_at: 0,
        update_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: '',
        object_type: '',
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
            options: [
                {id: 'a', name: 'Hello', rank: 1},
                {id: 'b', name: 'World', rank: 2},
            ],
        },
    });

    const openOptionPopover = async (chipTestId: string) => {
        await userEvent.click(screen.getByTestId(chipTestId));
        return screen.getByRole('textbox', {name: 'Option label'});
    };

    it('renders a numbered chip per option in ascending rank order', () => {
        renderWithContext(
            <UserPropertyRankValues
                field={baseField()}
                updateField={jest.fn()}
            />,
        );

        expect(screen.getByTestId('rank-chip-a')).toBeInTheDocument();
        expect(screen.getByTestId('rank-chip-b')).toBeInTheDocument();
    });

    it('shows a duplicate-name error and blocks the rename when renaming an option to another option\'s name', async () => {
        const updateField = jest.fn();
        renderWithContext(
            <UserPropertyRankValues
                field={baseField()}
                updateField={updateField}
            />,
        );

        const input = await openOptionPopover('rank-chip-b');
        await userEvent.clear(input);
        await userEvent.type(input, 'Hello');

        // The error indication appears inline rather than the rename silently reverting.
        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();

        // Committing the duplicate is a no-op.
        await userEvent.keyboard('{Enter}');
        expect(updateField).not.toHaveBeenCalled();
    });

    it('applies a rename to a unique name and keeps the option\'s rank', async () => {
        const updateField = jest.fn();
        renderWithContext(
            <UserPropertyRankValues
                field={baseField()}
                updateField={updateField}
            />,
        );

        const input = await openOptionPopover('rank-chip-b');
        await userEvent.clear(input);
        await userEvent.type(input, 'Earth{Enter}');

        expect(updateField).toHaveBeenCalledTimes(1);
        expect(updateField.mock.calls[0][0].attrs.options).toEqual([
            {id: 'a', name: 'Hello', rank: 1},
            {id: 'b', name: 'Earth', rank: 2},
        ]);
    });

    it('does not show the duplicate error while the label still matches the option\'s own name', async () => {
        renderWithContext(
            <UserPropertyRankValues
                field={baseField()}
                updateField={jest.fn()}
            />,
        );

        await openOptionPopover('rank-chip-b');

        // The popover opens showing the option's current name; no false-positive error.
        expect(screen.queryByText('Values must be unique.')).not.toBeInTheDocument();
    });
});
