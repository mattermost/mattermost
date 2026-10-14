// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {Store} from 'redux';

import {ThreadTypes} from 'mattermost-redux/action_types';
import {getThreadsForCurrentTeam} from 'mattermost-redux/actions/threads';

import {renderWithContext, runPostRenderAct, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GlobalThreads from './global_threads';

jest.mock('mattermost-redux/actions/threads', () => ({
    ...jest.requireActual('mattermost-redux/actions/threads'),
    getThreadCounts: jest.fn(() => ({type: 'MOCK_GET_THREAD_COUNTS'})),
    getThreadsForCurrentTeam: jest.fn(() => ({type: 'MOCK_GET_THREADS_FOR_CURRENT_TEAM'})),
}));

jest.mock('actions/user_actions', () => ({
    ...jest.requireActual('actions/user_actions'),
    loadProfilesForSidebar: jest.fn(),
}));

describe('components/threading/global_threads', () => {
    const channel = TestHelper.getChannelMock({id: 'channel1'});

    const baseState = {
        entities: {
            general: {
                config: {},
            },
            channels: {
                currentChannelId: channel.id,
                channels: {[channel.id]: channel},
                myMembers: {[channel.id]: TestHelper.getChannelMembershipMock({channel_id: channel.id, user_id: 'user1'})},
            },
            teams: {
                currentTeamId: 'team1',
                teams: {team1: TestHelper.getTeamMock({id: 'team1', name: 'team1'})},
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: TestHelper.getUserMock({id: 'user1'})},
            },
            preferences: {
                myPreferences: {},
            },
            posts: {
                posts: {},
            },
        },
    };

    let store: Store;

    describe('unreads filter', () => {
        const counts = {total: 1, total_unread_threads: 0, total_unread_mentions: 0, total_unread_urgent_mentions: 0};

        const unreadsState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                threads: {
                    threads: {
                        thread1: {id: 'thread1', is_following: true, last_reply_at: 100, unread_replies: 0, unread_mentions: 0},
                    },
                    threadsInTeam: {team1: ['thread1']},
                    unreadThreadsInTeam: {team1: []},
                    counts: {team1: counts},
                    countsIncludingDirect: {team1: counts},
                },
            },
            storage: {
                storage: {
                    'globalThreads_filter:user1:team1': {value: 'unread', timestamp: new Date()},
                },
            },
        };

        const receiveUnreadCount = (totalUnreadThreads: number) => {
            store.dispatch({
                type: ThreadTypes.RECEIVED_THREAD_COUNTS,
                data: {...counts, total_unread_threads: totalUnreadThreads, team_id: 'team1'},
            });
        };

        test('should refetch unread threads when the unread count changes while the list is empty', async () => {
            store = renderWithContext(<GlobalThreads/>, unreadsState).store;
            await runPostRenderAct();

            jest.mocked(getThreadsForCurrentTeam).mockClear();

            receiveUnreadCount(1);
            await runPostRenderAct();

            expect(getThreadsForCurrentTeam).toHaveBeenCalledWith({unread: true});
        });

        test('should not link to an undefined thread when no unread threads are loaded', async () => {
            store = renderWithContext(<GlobalThreads/>, unreadsState).store;
            await runPostRenderAct();

            receiveUnreadCount(1);
            await runPostRenderAct();

            expect(screen.getByRole('link', {name: '1 thread'}).getAttribute('href')).not.toContain('undefined');
        });

        test('should keep loading until the latest fetch finishes', async () => {
            const resolvers: Array<() => void> = [];
            const defaultImplementation = jest.mocked(getThreadsForCurrentTeam).getMockImplementation();
            const deferredFetch = () => new Promise<void>((resolve) => {
                resolvers.push(resolve);
            });
            jest.mocked(getThreadsForCurrentTeam).mockImplementation(() => deferredFetch as unknown as ReturnType<typeof getThreadsForCurrentTeam>);

            const emptyState = {
                ...unreadsState,
                entities: {
                    ...unreadsState.entities,
                    threads: {
                        ...unreadsState.entities.threads,
                        threads: {},
                        threadsInTeam: {team1: []},
                    },
                },
            };

            store = renderWithContext(<GlobalThreads/>, emptyState).store;
            await runPostRenderAct();
            const initialFetchCount = resolvers.length;

            receiveUnreadCount(1);
            await runPostRenderAct();
            expect(resolvers.length).toBeGreaterThan(initialFetchCount);

            resolvers.slice(0, initialFetchCount).forEach((resolve) => resolve());
            await runPostRenderAct();
            expect(screen.getByText('Loading')).toBeInTheDocument();

            resolvers.slice(initialFetchCount).forEach((resolve) => resolve());
            await runPostRenderAct();
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();

            jest.mocked(getThreadsForCurrentTeam).mockImplementation(defaultImplementation);
        });
    });
});
