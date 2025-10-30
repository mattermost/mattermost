// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Recap} from '@mattermost/types/recaps';

import {pollRecapStatus} from 'mattermost-redux/actions/recaps';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RecapsList from './recaps_list';

jest.mock('mattermost-redux/actions/recaps', () => ({
    pollRecapStatus: jest.fn(() => Promise.resolve({data: {}})),
}));

describe('RecapsList', () => {
    const mockCompletedRecaps: Recap[] = [
        {
            id: 'recap1',
            title: 'Morning Standup',
            user_id: 'user1',
            bot_id: 'bot1',
            status: 'completed',
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
            read_at: 0,
            channels: [],
            total_message_count: 5,
        },
        {
            id: 'recap2',
            title: 'Weekly Review',
            user_id: 'user1',
            bot_id: 'bot1',
            status: 'completed',
            create_at: 2000,
            update_at: 2000,
            delete_at: 0,
            read_at: 0,
            channels: [],
            total_message_count: 10,
        },
    ];

    const mockProcessingRecaps: Recap[] = [
        {
            id: 'recap3',
            title: 'Processing Recap',
            user_id: 'user1',
            bot_id: 'bot1',
            status: 'processing',
            create_at: 3000,
            update_at: 3000,
            delete_at: 0,
            read_at: 0,
            channels: [],
            total_message_count: 0,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render empty state when no recaps', () => {
        renderWithContext(<RecapsList recaps={[]}/>);

        expect(screen.getByText("You're all caught up")).toBeInTheDocument();
        expect(screen.getByText("You don't have any recaps yet. Create one to get started.")).toBeInTheDocument();
    });

    test('should render recap items when recaps exist', () => {
        renderWithContext(<RecapsList recaps={mockCompletedRecaps}/>);

        expect(screen.getByText('Morning Standup')).toBeInTheDocument();
        expect(screen.getByText('Weekly Review')).toBeInTheDocument();
    });

    test('should start polling for processing recaps', () => {
        renderWithContext(<RecapsList recaps={mockProcessingRecaps}/>);

        expect(pollRecapStatus).toHaveBeenCalledWith('recap3', 60, 3000);
        expect(pollRecapStatus).toHaveBeenCalledTimes(1);
    });

    test('should not poll for completed recaps', () => {
        renderWithContext(<RecapsList recaps={mockCompletedRecaps}/>);

        expect(pollRecapStatus).not.toHaveBeenCalled();
    });

    test('should poll for multiple processing recaps', () => {
        const multipleProcessing: Recap[] = [
            {...mockProcessingRecaps[0], id: 'recap4'},
            {...mockProcessingRecaps[0], id: 'recap5', status: 'pending'},
        ];

        renderWithContext(<RecapsList recaps={multipleProcessing}/>);

        expect(pollRecapStatus).toHaveBeenCalledWith('recap4', 60, 3000);
        expect(pollRecapStatus).toHaveBeenCalledWith('recap5', 60, 3000);
        expect(pollRecapStatus).toHaveBeenCalledTimes(2);
    });

    test('should not poll the same recap twice', () => {
        const {rerender} = renderWithContext(<RecapsList recaps={mockProcessingRecaps}/>);

        expect(pollRecapStatus).toHaveBeenCalledTimes(1);

        // Re-render with same recaps
        rerender(<RecapsList recaps={mockProcessingRecaps}/>);

        // Should still only be called once
        expect(pollRecapStatus).toHaveBeenCalledTimes(1);
    });

    test('should show "all caught up" message at the bottom', () => {
        renderWithContext(<RecapsList recaps={mockCompletedRecaps}/>);

        const allCaughtUpMessages = screen.getAllByText("You're all caught up");
        expect(allCaughtUpMessages.length).toBeGreaterThan(0);
    });

    test('should handle mixed status recaps', () => {
        const mixedRecaps = [...mockCompletedRecaps, ...mockProcessingRecaps];
        renderWithContext(<RecapsList recaps={mixedRecaps}/>);

        // Should render all recaps
        expect(screen.getByText('Morning Standup')).toBeInTheDocument();
        expect(screen.getByText('Weekly Review')).toBeInTheDocument();
        expect(screen.getByText('Processing Recap')).toBeInTheDocument();

        // Should only poll the processing one
        expect(pollRecapStatus).toHaveBeenCalledWith('recap3', 60, 3000);
        expect(pollRecapStatus).toHaveBeenCalledTimes(1);
    });
});

