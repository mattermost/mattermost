// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, act} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import FollowersTab from '../followers_tab';

const mockStore = configureStore([]);

// Mock Client4
let mockGetThreadFollowersResult: Promise<any[]> = Promise.resolve([]);
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getThreadFollowers: (..._args: any[]) => mockGetThreadFollowersResult,
    },
}));

// Mock react-redux
// Component calls useSelector twice per render: channelMembers then statuses.
// Using modulo so it works across re-renders without needing a counter reset.
let mockChannelMembers: any = null;
let mockStatuses: Record<string, string> = {};
let mockSelectorCallCount = 0;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: () => {
        const idx = mockSelectorCallCount;
        mockSelectorCallCount++;

        // Even calls: channelMembers, odd calls: statuses
        if (idx % 2 === 0) {
            return mockChannelMembers;
        }
        return mockStatuses;
    },
}));

// Mock MemberRow component
jest.mock('../member_row', () => ({user, status, isAdmin}: any) => (
    <div className="member-row" data-testid={`member-${user.username}`}>
        <span>{user.username}</span>
        <span data-testid={`status-${user.username}`}>{status}</span>
        {isAdmin && <span>Admin</span>}
    </div>
));

describe('FollowersTab', () => {
    const baseState = {
        entities: {
            general: {config: {}},
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSelectorCallCount = 0;
        mockChannelMembers = {};
        mockStatuses = {};
        mockGetThreadFollowersResult = Promise.resolve([]);
    });

    it('shows "No followers yet" when API returns empty list', async () => {
        mockGetThreadFollowersResult = Promise.resolve([]);

        const store = mockStore(baseState);

        await act(async () => {
            render(
                <Provider store={store}>
                    <FollowersTab threadId='thread1' channelId='channel1'/>
                </Provider>,
            );
        });

        expect(screen.getByText('No followers yet')).toBeInTheDocument();
    });

    it('shows followers grouped by status with role headers', async () => {
        const followers = [
            {id: 'user1', username: 'admin_alice', nickname: ''},
            {id: 'user2', username: 'member_bob', nickname: ''},
            {id: 'user3', username: 'offline_carol', nickname: ''},
        ];

        mockGetThreadFollowersResult = Promise.resolve(followers);
        mockChannelMembers = {
            user1: {scheme_admin: true},
            user2: {scheme_admin: false},
            user3: {scheme_admin: false},
        };
        mockStatuses = {
            user1: 'online',
            user2: 'online',
            user3: 'offline',
        };

        const store = mockStore(baseState);

        await act(async () => {
            render(
                <Provider store={store}>
                    <FollowersTab threadId='thread1' channelId='channel1'/>
                </Provider>,
            );
        });

        expect(screen.queryByText('No followers yet')).not.toBeInTheDocument();
        expect(screen.getByText('Admin — 1')).toBeInTheDocument();
        expect(screen.getByText('Member — 1')).toBeInTheDocument();
        expect(screen.getByText('Offline — 1')).toBeInTheDocument();
    });

    it('only shows groups that have followers', async () => {
        const followers = [
            {id: 'user1', username: 'member_only', nickname: ''},
        ];

        mockGetThreadFollowersResult = Promise.resolve(followers);
        mockChannelMembers = {
            user1: {scheme_admin: false},
        };
        mockStatuses = {
            user1: 'online',
        };

        const store = mockStore(baseState);

        await act(async () => {
            render(
                <Provider store={store}>
                    <FollowersTab threadId='thread1' channelId='channel1'/>
                </Provider>,
            );
        });

        expect(screen.getByText('Member — 1')).toBeInTheDocument();
        expect(screen.queryByText(/Admin —/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Offline —/)).not.toBeInTheDocument();
    });

    it('shows all followers as offline when no status data', async () => {
        const followers = [
            {id: 'user1', username: 'alice', nickname: ''},
            {id: 'user2', username: 'bob', nickname: ''},
        ];

        mockGetThreadFollowersResult = Promise.resolve(followers);
        mockChannelMembers = {};
        mockStatuses = {};

        const store = mockStore(baseState);

        await act(async () => {
            render(
                <Provider store={store}>
                    <FollowersTab threadId='thread1' channelId='channel1'/>
                </Provider>,
            );
        });

        expect(screen.getByText('Offline — 2')).toBeInTheDocument();
        expect(screen.queryByText(/Admin —/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Member —/)).not.toBeInTheDocument();
    });

    it('renders MemberRow for each follower with correct status', async () => {
        const followers = [
            {id: 'user1', username: 'alice', nickname: ''},
            {id: 'user2', username: 'bob', nickname: ''},
        ];

        mockGetThreadFollowersResult = Promise.resolve(followers);
        mockChannelMembers = {
            user1: {scheme_admin: false},
            user2: {scheme_admin: false},
        };
        mockStatuses = {
            user1: 'online',
            user2: 'away',
        };

        const store = mockStore(baseState);

        await act(async () => {
            render(
                <Provider store={store}>
                    <FollowersTab threadId='thread1' channelId='channel1'/>
                </Provider>,
            );
        });

        expect(screen.getByTestId('member-alice')).toBeInTheDocument();
        expect(screen.getByTestId('member-bob')).toBeInTheDocument();
    });

    it('shows "No followers yet" when API call fails', async () => {
        mockGetThreadFollowersResult = Promise.reject(new Error('API error'));

        const store = mockStore(baseState);

        await act(async () => {
            render(
                <Provider store={store}>
                    <FollowersTab threadId='thread1' channelId='channel1'/>
                </Provider>,
            );
        });

        expect(screen.getByText('No followers yet')).toBeInTheDocument();
    });
});
