// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import PersistentRhs from 'components/persistent_rhs/index';

const mockStore = configureStore([]);

// Mock useSelector values: channel, activeTab, selectedThreadId, threadRootPost
let mockSelectorCallCount = 0;
let mockSelectorValues: any[] = [];
const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: () => {
        const value = mockSelectorValues[mockSelectorCallCount] ?? null;
        mockSelectorCallCount++;
        return value;
    },
    useDispatch: () => mockDispatch,
}));

// Mock child components
jest.mock('components/persistent_rhs/rhs_tab_bar', () => ({activeTab, onTabChange, memberCount, threadCount}: any) => (
    <div data-testid='rhs-tab-bar'>
        <span>{`active: ${activeTab}`}</span>
        <span>{`memberCount: ${memberCount}`}</span>
        <span>{`threadCount: ${threadCount}`}</span>
        <button onClick={() => onTabChange('members')}>Members</button>
        <button onClick={() => onTabChange('threads')}>Threads</button>
    </div>
));

jest.mock('components/persistent_rhs/members_tab', () => () => (
    <div data-testid='members-tab'>MembersTab</div>
));

jest.mock('components/persistent_rhs/threads_tab', () => () => (
    <div data-testid='threads-tab'>ThreadsTab</div>
));

jest.mock('components/persistent_rhs/followers_tab', () => ({threadId, channelId}: any) => (
    <div data-testid='followers-tab'>
        <span>{`threadId: ${threadId}`}</span>
        <span>{`channelId: ${channelId}`}</span>
    </div>
));

jest.mock('components/persistent_rhs/group_dm_participants', () => ({channelId}: any) => (
    <div data-testid='group-dm-participants'>{`channelId: ${channelId}`}</div>
));

// Mock scss import
jest.mock('components/persistent_rhs/persistent_rhs.scss', () => ({}));

describe('PersistentRhs', () => {
    const baseState = {
        entities: {
            general: {config: {}},
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSelectorCallCount = 0;
        mockSelectorValues = [];
    });

    it('returns null for 1:1 DM channels', () => {
        // channel, activeTab, selectedThreadId, threadRootPost, stats, threads
        mockSelectorValues = [
            {id: 'dm1', type: 'D'},
            'members',
            null,
            null,
            {member_count: 2},
            [],
        ];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <PersistentRhs/>
            </Provider>,
        );

        expect(container.innerHTML).toBe('');
    });

    it('shows GroupDmParticipants for group DM channels', () => {
        // channel, activeTab, selectedThreadId, threadRootPost, stats, threads
        mockSelectorValues = [
            {id: 'gm1', type: 'G'},
            'members',
            null,
            null,
            {member_count: 3},
            [],
        ];

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <PersistentRhs/>
            </Provider>,
        );

        expect(screen.getByText('Participants')).toBeInTheDocument();
        expect(screen.getByTestId('group-dm-participants')).toBeInTheDocument();
    });

    it('shows Members/Threads tabs for regular channel when no thread selected', () => {
        // channel, activeTab, selectedThreadId, threadRootPost, stats, threads
        mockSelectorValues = [
            {id: 'channel1', type: 'O'},
            'members',
            null, // no selected thread
            null,
            {member_count: 16},
            [{id: 't1'}, {id: 't2'}],
        ];

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <PersistentRhs/>
            </Provider>,
        );

        expect(screen.getByTestId('rhs-tab-bar')).toBeInTheDocument();
        expect(screen.getByTestId('members-tab')).toBeInTheDocument();
        expect(screen.queryByTestId('followers-tab')).not.toBeInTheDocument();

        // Verify counts are passed to tab bar
        expect(screen.getByText('memberCount: 16')).toBeInTheDocument();
        expect(screen.getByText('threadCount: 2')).toBeInTheDocument();
    });

    it('shows ThreadsTab when threads tab is active', () => {
        // channel, activeTab, selectedThreadId, threadRootPost, stats, threads
        mockSelectorValues = [
            {id: 'channel1', type: 'O'},
            'threads',
            null,
            null,
            {member_count: 5},
            [{id: 't1'}],
        ];

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <PersistentRhs/>
            </Provider>,
        );

        expect(screen.getByTestId('threads-tab')).toBeInTheDocument();
        expect(screen.queryByTestId('members-tab')).not.toBeInTheDocument();
    });

    it('shows FollowersTab when a thread is selected', () => {
        // channel, activeTab, selectedThreadId, threadRootPost, stats, threads
        mockSelectorValues = [
            {id: 'channel1', type: 'O'},
            'members',
            'thread123', // selected thread
            {id: 'thread123', channel_id: 'channel1', message: 'hello'}, // root post
            {member_count: 10},
            [],
        ];

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <PersistentRhs/>
            </Provider>,
        );

        expect(screen.getByText('Thread Followers')).toBeInTheDocument();
        expect(screen.getByTestId('followers-tab')).toBeInTheDocument();
        expect(screen.getByText('threadId: thread123')).toBeInTheDocument();
        expect(screen.getByText('channelId: channel1')).toBeInTheDocument();

        // Should NOT show Members/Threads tabs
        expect(screen.queryByTestId('rhs-tab-bar')).not.toBeInTheDocument();
        expect(screen.queryByTestId('members-tab')).not.toBeInTheDocument();
    });

    it('falls back to Members/Threads when thread selected but root post not loaded', () => {
        // channel, activeTab, selectedThreadId, threadRootPost, stats, threads
        mockSelectorValues = [
            {id: 'channel1', type: 'O'},
            'members',
            'thread123', // selected thread
            null, // root post not yet loaded
            {member_count: 8},
            [],
        ];

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <PersistentRhs/>
            </Provider>,
        );

        // Should fall through to regular channel view
        expect(screen.getByTestId('rhs-tab-bar')).toBeInTheDocument();
        expect(screen.getByTestId('members-tab')).toBeInTheDocument();
        expect(screen.queryByTestId('followers-tab')).not.toBeInTheDocument();
    });
});
