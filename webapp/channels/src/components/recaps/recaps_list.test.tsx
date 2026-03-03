// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Recap} from '@mattermost/types/recaps';
import {RecapStatus} from '@mattermost/types/recaps';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RecapsList from './recaps_list';

jest.mock('mattermost-redux/actions/recaps', () => ({
    pollRecapStatus: jest.fn(() => ({type: 'POLL_RECAP_STATUS'})),
}));

describe('RecapsList', () => {
    const mockCompletedRecaps: Recap[] = [
        {
            id: 'recap1',
            title: 'Morning Standup',
            user_id: 'user1',
            bot_id: 'bot1',
            status: RecapStatus.COMPLETED,
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
            status: RecapStatus.COMPLETED,
            create_at: 2000,
            update_at: 2000,
            delete_at: 0,
            read_at: 0,
            channels: [],
            total_message_count: 10,
        },
    ];

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

    test('should show "all caught up" message at the bottom', () => {
        renderWithContext(<RecapsList recaps={mockCompletedRecaps}/>);

        const allCaughtUpMessages = screen.getAllByText("You're all caught up");
        expect(allCaughtUpMessages.length).toBeGreaterThan(0);
    });
});

