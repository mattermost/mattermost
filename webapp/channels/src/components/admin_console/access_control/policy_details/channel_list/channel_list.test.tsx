// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import {fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import ChannelList from './channel_list';

describe('components/admin_console/access_control/channel_list', () => {
    const mockSearchChannels = jest.fn();
    const mockSetChannelListSearch = jest.fn();
    const mockSetChannelListFilters = jest.fn();
    const mockOnRemoveCallback = jest.fn();
    const mockOnUndoRemoveCallback = jest.fn();
    const mockOnAddCallback = jest.fn();
    const mockOnPolicyActiveStatusChange = jest.fn();

    const channel1 = {
        id: 'channel1',
        name: 'channel1',
        display_name: 'Channel 1',
        team_display_name: 'Team 1',
        type: 'O',
        policy_auto_add: true,
    } as ChannelWithTeamData;
    const channel2 = {
        id: 'channel2',
        name: 'channel2',
        display_name: 'Channel 2',
        team_display_name: 'Team 2',
        type: 'P',
        policy_auto_add: false,
    } as ChannelWithTeamData;

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
        onPolicyActiveStatusChange: mockOnPolicyActiveStatusChange,
        actions: {
            searchChannels: jest.fn().mockResolvedValue({
                data: {
                    channels: [channel1, channel2],
                },
            }),
            setChannelListSearch: mockSetChannelListSearch,
            setChannelListFilters: mockSetChannelListFilters,
        },
    };

    beforeEach(() => {
        mockSearchChannels.mockReset();
        mockSetChannelListSearch.mockReset();
        mockSetChannelListFilters.mockReset();
        mockOnRemoveCallback.mockReset();
        mockOnUndoRemoveCallback.mockReset();
        mockOnAddCallback.mockReset();
        mockOnPolicyActiveStatusChange.mockReset();
    });

    test('should match snapshot with no channels', () => {
        // The Filter component has an existing prop type issue with TeamFilterDropdown
        // that only surfaces during full rendering (not shallow). Suppress for this test.
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const props = {
            ...defaultProps,
            channels: [],
            totalCount: 0,
            policyId: '',
        };
        try {
            const {container} = renderWithContext(<ChannelList {...props}/>);
            expect(container).toMatchSnapshot();
        } finally {
            errorSpy.mockRestore();
        }
    });

    test('should match snapshot with channels', () => {
        const props = {
            ...defaultProps,
            totalCount: 2,
            policyId: 'policy1',
            actions: {
                ...defaultProps.actions,
            },
        };
        const {container} = renderWithContext(<ChannelList {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with channels to remove', () => {
        const props = {
            ...defaultProps,
            totalCount: 2,
            policyId: 'policy1',
            channelsToRemove: {
                channel1,
            },
        };
        const {container} = renderWithContext(<ChannelList {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with channels to add', () => {
        const props = {
            ...defaultProps,
            channelsToAdd: {
                channel3: {
                    id: 'channel3',
                    name: 'channel3',
                    display_name: 'Channel 3',
                    team_display_name: 'Team 1',
                    type: 'O',
                } as ChannelWithTeamData,
            },
        };
        const {container} = renderWithContext(<ChannelList {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should render header checkbox with stable id and indeterminate when auto-add is mixed', async () => {
        const props = {
            ...defaultProps,
            channels: [channel1, channel2],
            totalCount: 2,
        };

        renderWithContext(<ChannelList {...props}/>);

        await waitFor(() => {
            expect(screen.getByTestId('auto-add-header-checkbox')).toBeInTheDocument();
        });

        const headerCheckbox = screen.getByTestId('auto-add-header-checkbox');
        expect(headerCheckbox).toHaveAttribute('id', 'auto-add-header-checkbox');
        expect(headerCheckbox).toHaveAttribute('aria-checked', 'mixed');
        expect((headerCheckbox as HTMLInputElement).indeterminate).toBe(true);
    });

    test('should toggle per-row and header auto-add checkboxes', async () => {
        const props = {
            ...defaultProps,
            channels: [channel1, channel2],
            totalCount: 2,
        };

        renderWithContext(<ChannelList {...props}/>);

        await waitFor(() => {
            expect(screen.getByTestId('auto-add-checkbox-channel1')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('auto-add-checkbox-channel1'));
        expect(mockOnPolicyActiveStatusChange).toHaveBeenCalledWith([
            {id: 'channel1', active: false},
        ]);

        mockOnPolicyActiveStatusChange.mockClear();
        fireEvent.click(screen.getByTestId('auto-add-header-checkbox'));
        expect(mockOnPolicyActiveStatusChange).toHaveBeenCalledWith([
            {id: 'channel1', active: true},
            {id: 'channel2', active: true},
        ]);
    });
});
