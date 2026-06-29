// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';

import RankedSchemaModal from './ranked_schema_modal';

describe('RankedSchemaModal', () => {
    const field: UserPropertyField = {
        id: 'field-id',
        name: 'Clearance',
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
                {id: 'a', name: 'Low', rank: 1},
                {id: 'b', name: 'Mid', rank: 2},
                {id: 'c', name: 'High', rank: 3},
            ],
        },
    };

    const renderModal = () => {
        const onSave = jest.fn();
        const onExited = jest.fn();
        renderWithContext(
            <RankedSchemaModal
                field={field}
                onSave={onSave}
                onExited={onExited}
            />,
        );
        return {onSave, onExited};
    };

    const rows = () => screen.getAllByTestId('rankedSchemaRow');

    it('lists values lowest-first with contiguous ranks and Lowest/Highest labels', () => {
        renderModal();

        const [low, mid, high] = rows();

        expect(within(low).getByText('Low')).toBeInTheDocument();
        expect(within(low).getByText('Lowest')).toBeInTheDocument();
        expect(within(low).getByText('1')).toBeInTheDocument();

        expect(within(mid).getByText('Mid')).toBeInTheDocument();
        expect(within(mid).getByText('2')).toBeInTheDocument();
        expect(within(mid).queryByText('Lowest')).not.toBeInTheDocument();
        expect(within(mid).queryByText('Highest')).not.toBeInTheDocument();

        expect(within(high).getByText('High')).toBeInTheDocument();
        expect(within(high).getByText('Highest')).toBeInTheDocument();
        expect(within(high).getByText('3')).toBeInTheDocument();
    });

    it('renders names and ranks as static content, not editable inputs or steppers', () => {
        renderModal();

        // No editable fields are visible until "Add value" is clicked.
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

        // The arrow steppers are gone.
        expect(screen.queryByLabelText('Move up')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Move down')).not.toBeInTheDocument();
    });

    it('shows the field name and the "Ranked attribute" suffix in the title', () => {
        renderModal();

        expect(screen.getByText('Clearance')).toBeInTheDocument();
        expect(screen.getByText('Ranked attribute')).toBeInTheDocument();
    });

    it('renumbers the remaining rows contiguously when a row is removed', async () => {
        renderModal();

        // Remove "Mid" (rank 2).
        await userEvent.click(within(rows()[1]).getByLabelText('Remove value'));

        const [low, high] = rows();
        expect(within(low).getByText('Low')).toBeInTheDocument();
        expect(within(low).getByText('1')).toBeInTheDocument();
        expect(within(high).getByText('High')).toBeInTheDocument();
        expect(within(high).getByText('Highest')).toBeInTheDocument();
        expect(within(high).getByText('2')).toBeInTheDocument();
    });

    it('saves contiguous ranks in ascending order after a removal', async () => {
        const {onSave, onExited} = renderModal();

        await userEvent.click(within(rows()[1]).getByLabelText('Remove value'));
        await userEvent.click(screen.getByText('Save'));

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onExited).toHaveBeenCalledTimes(1);
        expect(onSave.mock.calls[0][0].attrs.options).toEqual([
            {id: 'a', name: 'Low', rank: 1},
            {id: 'c', name: 'High', rank: 2},
        ]);
    });

    it('adds a typed value as the new highest rank', async () => {
        const {onSave} = renderModal();

        await userEvent.click(screen.getByText('Add value'));
        await userEvent.type(screen.getByPlaceholderText('Add value…'), 'Critical{enter}');

        // The new value sits at the bottom (highest) and "High" is no longer the top rank.
        const allRows = rows();
        expect(allRows).toHaveLength(4);
        const last = allRows[3];
        expect(within(last).getByText('Critical')).toBeInTheDocument();
        expect(within(last).getByText('Highest')).toBeInTheDocument();
        expect(within(last).getByText('4')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Save'));
        expect(onSave.mock.calls[0][0].attrs.options).toEqual([
            {id: 'a', name: 'Low', rank: 1},
            {id: 'b', name: 'Mid', rank: 2},
            {id: 'c', name: 'High', rank: 3},
            {id: '', name: 'Critical', rank: 4},
        ]);
    });

    it('commits the value on Enter without closing the modal', async () => {
        const {onSave, onExited} = renderModal();

        await userEvent.click(screen.getByText('Add value'));
        await userEvent.type(screen.getByPlaceholderText('Add value…'), 'Critical{enter}');

        // Enter added the value rather than confirming/closing the modal...
        expect(onExited).not.toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText('Critical')).toBeInTheDocument();

        // ...and the add field stays open for the next value.
        expect(screen.getByPlaceholderText('Add value…')).toBeInTheDocument();
    });

    it('ignores a duplicate value and warns the user', async () => {
        renderModal();

        await userEvent.click(screen.getByText('Add value'));
        await userEvent.type(screen.getByPlaceholderText('Add value…'), 'Low');

        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();

        await userEvent.keyboard('{enter}');
        expect(rows()).toHaveLength(3);
    });
});
