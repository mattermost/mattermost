// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupTeamsAndChannels from 'components/admin_console/group_settings/group_details/group_teams_and_channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupTeamsAndChannels', () => {
    const defaultProps = {
        id: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
        teams: [
            {
                team_id: '11111111111111111111111111',
                team_type: 'O',
                team_display_name: 'Team 1',
            },
            {
                team_id: '22222222222222222222222222',
                team_type: 'P',
                team_display_name: 'Team 2',
            },
            {
                team_id: '33333333333333333333333333',
                team_type: 'P',
                team_display_name: 'Team 3',
            },
        ],
        channels: [
            {
                team_id: '11111111111111111111111111',
                team_type: 'O',
                team_display_name: 'Team 1',
                channel_id: '44444444444444444444444444',
                channel_type: 'O',
                channel_display_name: 'Channel 4',
            },
            {
                team_id: '99999999999999999999999999',
                team_type: 'O',
                team_display_name: 'Team 9',
                channel_id: '55555555555555555555555555',
                channel_type: 'P',
                channel_display_name: 'Channel 5',
            },
            {
                team_id: '99999999999999999999999999',
                team_type: 'O',
                team_display_name: 'Team 9',
                channel_id: '66666666666666666666666666',
                channel_type: 'P',
                channel_display_name: 'Channel 6',
            },
        ],
        loading: false,
        getGroupSyncables: jest.fn().mockReturnValue(Promise.resolve()),
        unlink: jest.fn(),
        onChangeRoles: jest.fn(),
        onRemoveItem: jest.fn(),
    };

    test('should match snapshot, with teams, with channels and loading', () => {
        const {container} = renderWithContext(
            <GroupTeamsAndChannels
                {...defaultProps}
                loading={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with teams, with channels and loaded', () => {
        const {container} = renderWithContext(
            <GroupTeamsAndChannels
                {...defaultProps}
                loading={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without teams, without channels and loading', () => {
        const {container} = renderWithContext(
            <GroupTeamsAndChannels
                {...defaultProps}
                teams={[]}
                channels={[]}
                loading={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without teams, without channels and loaded', () => {
        const {container} = renderWithContext(
            <GroupTeamsAndChannels
                {...defaultProps}
                teams={[]}
                channels={[]}
                loading={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should toggle the collapse for an element', async () => {
        renderWithContext(<GroupTeamsAndChannels {...defaultProps}/>);

        // Team 1 has children (Channel 4), so it should have a caret icon
        // Initially not collapsed, so caret-down is shown and channel is visible
        expect(screen.getByText('Channel 4')).toBeInTheDocument();

        // Find the caret for Team 1 and click it to collapse
        const caretDown = document.querySelector('.fa-caret-down');
        expect(caretDown).toBeInTheDocument();
        await userEvent.click(caretDown!);

        // After collapsing Team 1, Channel 4 should no longer be visible
        expect(screen.queryByText('Channel 4')).not.toBeInTheDocument();

        // Click again to expand
        const caretRight = document.querySelectorAll('.fa-caret-right');

        // Find the caret that belongs to Team 1 (the first one with caret-right within team rows)
        await userEvent.click(caretRight[0]);

        // Channel 4 should be visible again
        expect(screen.getByText('Channel 4')).toBeInTheDocument();
    });

    test('should invoke the onRemoveItem callback', async () => {
        const onRemoveItem = jest.fn();
        renderWithContext(
            <GroupTeamsAndChannels
                {...defaultProps}
                onChangeRoles={jest.fn()}
                onRemoveItem={onRemoveItem}
            />,
        );

        // Click the remove button for Team 1
        const removeButton = screen.getByTestId('Team 1_groupsyncable_remove');
        await userEvent.click(removeButton);

        // Confirm the removal in the modal
        const confirmButton = screen.getByText('Yes, Remove');
        await userEvent.click(confirmButton);

        expect(onRemoveItem).toHaveBeenCalledWith(
            '11111111111111111111111111',
            'public-team',
        );
    });

    test('should invoke the onChangeRoles callback', async () => {
        const onChangeRoles = jest.fn();
        renderWithContext(
            <GroupTeamsAndChannels
                {...defaultProps}
                teams={[
                    {
                        team_id: '11111111111111111111111111',
                        team_type: 'O',
                        team_display_name: 'Team 1',
                        scheme_admin: false,
                    },
                ]}
                channels={[]}
                onChangeRoles={onChangeRoles}
                onRemoveItem={jest.fn()}
            />,
        );

        // Click on the current role dropdown for Team 1
        const roleDropdown = screen.getByTestId('Team 1_current_role');
        await userEvent.click(roleDropdown);

        // Click the role option to change (Team Admin)
        const roleOption = screen.getByText('Team Admin');
        await userEvent.click(roleOption);

        expect(onChangeRoles).toHaveBeenCalledWith(
            '11111111111111111111111111',
            'public-team',
            true,
        );
    });
});
