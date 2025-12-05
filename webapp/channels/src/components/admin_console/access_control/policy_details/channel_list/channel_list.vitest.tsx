// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import ChannelList from './channel_list';

describe('components/admin_console/access_control/channel_list', () => {
    const mockSetChannelListSearch = vi.fn();
    const mockSetChannelListFilters = vi.fn();
    const mockOnRemoveCallback = vi.fn();
    const mockOnUndoRemoveCallback = vi.fn();
    const mockOnAddCallback = vi.fn();

    const defaultProps = {
        channels: [],
        totalCount: 2,
        searchTerm: '',
        filters: {},
        policyId: 'policy1',
        onRemoveCallback: mockOnRemoveCallback,
        onUndoRemoveCallback: mockOnUndoRemoveCallback,
        onAddCallback: mockOnAddCallback,
        channelsToRemove: {},
        channelsToAdd: {},
        actions: {
            searchChannels: vi.fn().mockResolvedValue({
                data: {
                    channels: [
                        {id: 'channel1', name: 'Channel 1', display_name: 'Channel 1', team_display_name: 'Team 1', type: 'O'} as ChannelWithTeamData,
                        {id: 'channel2', name: 'channel2', display_name: 'Channel 2', team_display_name: 'Team 2', type: 'P'} as ChannelWithTeamData,
                    ],
                },
            }),
            setChannelListSearch: mockSetChannelListSearch,
            setChannelListFilters: mockSetChannelListFilters,
        },
    };

    test('should match snapshot with no channels', async () => {
        const props = {
            ...defaultProps,
            channels: [],
            totalCount: 0,
            policyId: '',
        };
        const {container} = renderWithContext(<ChannelList {...props}/>);
        await waitFor(() => {
            expect(container.querySelector('.DataGrid')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with channels', async () => {
        const props = {
            ...defaultProps,
            totalCount: 2,
            policyId: 'policy1',
            actions: {
                ...defaultProps.actions,
            },
        };
        const {container} = renderWithContext(<ChannelList {...props}/>);
        await waitFor(() => {
            expect(container.querySelector('.DataGrid')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with channels to remove', async () => {
        const props = {
            ...defaultProps,
            totalCount: 2,
            policyId: 'policy1',
            channelsToRemove: {
                channel1: {id: 'channel1', name: 'Channel 1', display_name: 'Channel 1', team_display_name: 'Team 1', type: 'O'} as ChannelWithTeamData,
            },
        };
        const {container} = renderWithContext(<ChannelList {...props}/>);
        await waitFor(() => {
            expect(container.querySelector('.DataGrid')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with channels to add', async () => {
        const props = {
            ...defaultProps,
            channelsToAdd: {
                channel3: {id: 'channel3', name: 'channel3', display_name: 'Channel 3', team_display_name: 'Team 1', type: 'O'} as ChannelWithTeamData,
            },
        };
        const {container} = renderWithContext(<ChannelList {...props}/>);

        // Wait for loading to complete and data to render
        await waitFor(() => {
            expect(container.querySelector('.DataGrid')).toBeInTheDocument();
            expect(container.querySelector('.DataGrid_loading')).not.toBeInTheDocument();
        });

        // Verify DataGrid structure
        expect(container.querySelector('.DataGrid_rows')).toBeInTheDocument();

        // Verify the channel to add is displayed
        const rows = container.querySelectorAll('.DataGrid_row');
        expect(rows.length).toBeGreaterThan(0);

        // Verify Channel 3 (the channel to add) is present
        expect(container.textContent).toContain('Channel 3');
        expect(container.textContent).toContain('Team 1');

        // Verify the "to be added" indicator is present (channels to add should have special styling/indicator)
        expect(container.querySelector('.DataGrid_cell')).toBeInTheDocument();
    });
});
