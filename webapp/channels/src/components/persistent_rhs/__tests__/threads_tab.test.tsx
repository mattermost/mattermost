// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import ThreadsTab from '../threads_tab';

const mockStore = configureStore([]);

// Mock react-router-dom useHistory
const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: mockPush,
    }),
}));

// Mock react-virtualized-auto-sizer
jest.mock('react-virtualized-auto-sizer', () => ({
    __esModule: true,
    default: ({children}: {children: (size: {height: number; width: number}) => React.ReactNode}) =>
        children({height: 500, width: 300}),
}));

// Mock react-redux useSelector - variables must be prefixed with 'mock'
let mockCallCount = 0;
let mockValues: any[] = [];

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: () => {
        const value = mockValues[mockCallCount] ?? null;
        mockCallCount++;
        return value;
    },
}));

// Mock ThreadRow component
jest.mock('../thread_row', () => ({thread, onClick}: any) => (
    <button
        className="thread-row"
        data-testid={`thread-${thread.id}`}
        onClick={onClick}
    >
        <span>{thread.rootPost.message}</span>
        <span>{thread.replyCount} replies</span>
    </button>
));

describe('ThreadsTab', () => {
    const baseState = {
        entities: {
            general: {config: {}},
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockCallCount = 0;
        mockPush.mockClear();
        // Default: channel, teamUrl (relative), threads
        mockValues = [
            {id: 'channel1', name: 'channel1'},
            '/test-team', // getCurrentRelativeTeamUrl returns relative path
            [],
        ];
    });

    it('shows "No threads yet" when threads array is empty', () => {
        mockValues = [
            {id: 'channel1', name: 'channel1'},
            '/test-team',
            [],
        ];
        mockCallCount = 0;

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ThreadsTab />
            </Provider>,
        );

        expect(screen.getByText('No threads yet')).toBeInTheDocument();
        expect(screen.getByText('Threads will appear here when someone replies to a message')).toBeInTheDocument();
    });

    it('shows thread list when threads exist', () => {
        const mockThreads = [
            {
                id: 'thread1',
                rootPost: {id: 'thread1', message: 'First thread', channel_id: 'channel1'},
                replyCount: 5,
                participants: ['user1', 'user2'],
                hasUnread: true,
            },
            {
                id: 'thread2',
                rootPost: {id: 'thread2', message: 'Second thread', channel_id: 'channel1'},
                replyCount: 3,
                participants: ['user1'],
                hasUnread: false,
            },
        ];

        mockValues = [
            {id: 'channel1', name: 'channel1'},
            '/test-team',
            mockThreads,
        ];
        mockCallCount = 0;

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ThreadsTab />
            </Provider>,
        );

        // Should not show empty state
        expect(screen.queryByText('No threads yet')).not.toBeInTheDocument();

        // Should show threads
        expect(screen.getByTestId('thread-thread1')).toBeInTheDocument();
        expect(screen.getByTestId('thread-thread2')).toBeInTheDocument();
    });

    it('navigates to thread when clicked', () => {
        const mockThreads = [
            {
                id: 'thread1',
                rootPost: {id: 'thread1', message: 'First thread', channel_id: 'channel1'},
                replyCount: 5,
                participants: ['user1'],
                hasUnread: false,
            },
        ];

        mockValues = [
            {id: 'channel1', name: 'channel1'},
            '/test-team',
            mockThreads,
        ];
        mockCallCount = 0;

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ThreadsTab />
            </Provider>,
        );

        const threadRow = screen.getByTestId('thread-thread1');
        fireEvent.click(threadRow);

        expect(mockPush).toHaveBeenCalledWith('/test-team/threads/thread1');
    });

    it('shows empty state when no channel is selected', () => {
        mockValues = [
            null, // No channel
            '/test-team',
            [],
        ];
        mockCallCount = 0;

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ThreadsTab />
            </Provider>,
        );

        expect(screen.getByText('No threads yet')).toBeInTheDocument();
    });
});
