// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelsMissingAttributeValueList} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ChannelsWithoutValueModal from './channels_without_value_modal';

import {fetchChannelsMissingValue} from '../../utils';

jest.mock('../../utils', () => ({
    __esModule: true,
    fetchChannelsMissingValue: jest.fn(),
}));

const mockedFetch = jest.mocked(fetchChannelsMissingValue);

function page(overrides: Partial<ChannelsMissingAttributeValueList> = {}): ChannelsMissingAttributeValueList {
    return {
        channels: [],
        total_count: 0,
        ...overrides,
    };
}

describe('ChannelsWithoutValueModal', () => {
    const onExited = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders rows with a team-scoped link and comma-joined admins', async () => {
        mockedFetch.mockResolvedValue(page({
            total_count: 2,
            channels: [
                {
                    channel_id: 'c1',
                    channel_name: 'ops-planning',
                    channel_display_name: 'ops-planning',
                    channel_type: 'O',
                    team_id: 't1',
                    team_display_name: 'Team 1',
                    is_local: true,
                    channel_admins: [
                        {id: 'u1', username: 'maya', first_name: 'Maya', last_name: 'Chen', nickname: ''},
                        {id: 'u2', username: 'jonah', first_name: 'Jonah', last_name: 'Blake', nickname: ''},
                    ],
                },
                {
                    channel_id: 'c2',
                    channel_name: 'logistics-sync',
                    channel_display_name: 'logistics-sync',
                    channel_type: 'P',
                    team_id: 't1',
                    team_display_name: 'Team 1',
                    is_local: true,
                    channel_admins: [],
                },
            ],
        }));

        renderWithContext(
            <ChannelsWithoutValueModal
                fieldId='field1'
                attributeDisplayName='Cost center'
                totalCount={2}
                onExited={onExited}
            />,
        );

        await waitFor(() => expect(screen.getByText('ops-planning')).toBeInTheDocument());

        expect(screen.getByRole('link', {name: /ops-planning/})).toHaveAttribute('href', '/admin_console/user_management/channels/c1');
        expect(screen.getByText('Maya Chen, Jonah Blake')).toBeInTheDocument();
        expect(screen.getByText('No channel admin')).toBeInTheDocument();
    });

    it('shows the subtitle count from props before the first page resolves', () => {
        mockedFetch.mockReturnValue(new Promise(() => {})); // never resolves in this test

        renderWithContext(
            <ChannelsWithoutValueModal
                fieldId='field1'
                attributeDisplayName='Cost center'
                totalCount={26}
                onExited={onExited}
            />,
        );

        expect(screen.getByText('26 channels still need a Cost center value')).toBeInTheDocument();
    });

    it('shows an empty state when nothing is missing', async () => {
        mockedFetch.mockResolvedValue(page());

        renderWithContext(
            <ChannelsWithoutValueModal
                fieldId='field1'
                totalCount={0}
                onExited={onExited}
            />,
        );

        await waitFor(() => expect(screen.getByText('Every channel has a value')).toBeInTheDocument());
    });

    it('shows an error state with a retry that refetches', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('boom'));
        mockedFetch.mockResolvedValueOnce(page({
            total_count: 1,
            channels: [{
                channel_id: 'c1',
                channel_name: 'ops-planning',
                channel_display_name: 'ops-planning',
                channel_type: 'O',
                team_id: 't1',
                team_display_name: 'Team 1',
                is_local: true,
                channel_admins: [],
            }],
        }));

        renderWithContext(
            <ChannelsWithoutValueModal
                fieldId='field1'
                totalCount={1}
                onExited={onExited}
            />,
        );

        await waitFor(() => expect(screen.getByText('The channel list couldn\'t be loaded.')).toBeInTheDocument());

        await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

        await waitFor(() => expect(screen.getByText('ops-planning')).toBeInTheDocument());
    });

    it('calls onExited when Close is clicked', async () => {
        mockedFetch.mockResolvedValue(page());

        renderWithContext(
            <ChannelsWithoutValueModal
                fieldId='field1'
                totalCount={0}
                onExited={onExited}
            />,
        );

        // Two buttons share the "Close" name: GenericModal's own header X and
        // the footer confirm button this component supplies. The footer one
        // renders last.
        const closeButtons = screen.getAllByRole('button', {name: 'Close'});
        await userEvent.click(closeButtons[closeButtons.length - 1]);

        expect(onExited).toHaveBeenCalled();
    });
});
