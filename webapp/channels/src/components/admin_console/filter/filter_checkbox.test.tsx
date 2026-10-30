// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import FilterCheckbox from './filter_checkbox';

describe('admin_console/filter/FilterCheckbox', () => {
    test('should render controlled checkbox with label', () => {
        renderWithContext(
            <FilterCheckbox
                name='anyone_can_join'
                checked={true}
                label='Anyone Can Join'
                updateOption={jest.fn()}
            />,
        );

        const checkbox = screen.getByRole('checkbox', {name: 'Anyone Can Join'});
        expect(checkbox).toBeChecked();
        expect(checkbox).toHaveAttribute('id', 'anyone_can_join');
        expect(checkbox).toHaveAttribute('name', 'anyone_can_join');
    });

    test('should call updateOption with next checked state on change', async () => {
        const updateOption = jest.fn();
        renderWithContext(
            <FilterCheckbox
                name='invite_only'
                checked={false}
                label='Invite Only'
                updateOption={updateOption}
            />,
        );

        const checkbox = screen.getByRole('checkbox', {name: 'Invite Only'});
        expect(checkbox).not.toBeChecked();

        await userEvent.click(checkbox);

        expect(updateOption).toHaveBeenCalledTimes(1);
        expect(updateOption).toHaveBeenCalledWith(true, 'invite_only');
    });

    test('should call updateOption once when label is clicked', async () => {
        const updateOption = jest.fn();
        renderWithContext(
            <FilterCheckbox
                name='group_sync'
                checked={true}
                label='Group Sync'
                updateOption={updateOption}
            />,
        );

        await userEvent.click(screen.getByText('Group Sync'));

        expect(updateOption).toHaveBeenCalledTimes(1);
        expect(updateOption).toHaveBeenCalledWith(false, 'group_sync');
    });
});
