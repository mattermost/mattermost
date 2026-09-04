// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import type {PlatformNotificationRecord} from 'types/store/rhs';

import RhsNotificationActivity from './rhs_notification_activity';

jest.mock('actions/views/platform_notification_activity', () => ({
    fillPlatformNotificationActivity: jest.fn(() => ({type: 'MOCK_FILL_PLATFORM_NOTIFICATION_ACTIVITY'})),
}));

jest.mock('./rhs_notification_card', () => ({
    __esModule: true,
    default: ({record}: {record: PlatformNotificationRecord}) => (
        <div data-testid={`notification-card-${record.id}`}>{record.previewBody}</div>
    ),
}));

const record: PlatformNotificationRecord = {
    id: 'n1',
    recordedAt: 100,
    postId: 'post1',
    channelId: 'channel1',
    teamId: 'team1',
    channelDisplayName: 'Town Square',
    contextLabel: 'Mention',
    permalinkUrl: '/permalink',
    isThreadReply: false,
    previewBody: '@alice: hello',
};

describe('RhsNotificationActivity', () => {
    test('shows the empty state when there are no notifications', () => {
        const {getByText} = renderWithContext(
            <RhsNotificationActivity notifications={[]}/>,
        );

        expect(getByText('No notifications yet')).toBeInTheDocument();
        expect(getByText(/Mark them as read when you are done/)).toBeInTheDocument();
    });

    test('renders a card for each notification', () => {
        const {getByTestId, queryByText} = renderWithContext(
            <RhsNotificationActivity notifications={[record]}/>,
        );

        expect(getByTestId('notification-card-n1')).toHaveTextContent('@alice: hello');
        expect(queryByText('No notifications yet')).not.toBeInTheDocument();
    });

    test('renders date separators like the mentions tab', () => {
        const today = Date.now();
        const yesterday = today - (24 * 60 * 60 * 1000);
        const {getByTestId, getByText, getAllByTestId} = renderWithContext(
            <RhsNotificationActivity
                notifications={[
                    {...record, id: 'n-today', recordedAt: today, previewBody: 'today mention'},
                    {...record, id: 'n-yesterday', recordedAt: yesterday, previewBody: 'yesterday mention'},
                ]}
            />,
        );

        expect(getByTestId('notification-card-n-today')).toHaveTextContent('today mention');
        expect(getByTestId('notification-card-n-yesterday')).toHaveTextContent('yesterday mention');
        expect(getByText('Today')).toBeInTheDocument();
        expect(getByText('Yesterday')).toBeInTheDocument();
        expect(getAllByTestId('basicSeparator')).toHaveLength(2);
    });
});
