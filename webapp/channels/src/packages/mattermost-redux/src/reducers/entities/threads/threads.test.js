// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TeamTypes, ThreadTypes, PostTypes, ChannelTypes} from 'mattermost-redux/action_types';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import threadsReducer from './index';

describe('threads', () => {
    test('RECEIVED_THREADS should update the state', () => {
        const state = deepFreeze({
            threadsInTeam: {},
            threads: {},
            counts: {},
            countsIncludingDirect: {
                a: {
                    total: 3,
                    total_unread_threads: 0,
                    total_unread_mentions: 1,
                },
            },
        });

        const nextState = threadsReducer(state, {
            type: ThreadTypes.RECEIVED_THREADS,
            data: {
                team_id: 'a',
                threads: [
                    {id: 't1'},
                ],
                total: 0,
                total_unread_threads: 0,
                total_unread_mentions: 0,
            },
        });

        expect(nextState).not.toBe(state);
        expect(nextState.threads.t1).toEqual({
            id: 't1',
        });
        expect(nextState.counts.a).toBe(state.counts.a);
        expect(nextState.countsIncludingDirect.a).toEqual({
            total: 3,
            total_unread_threads: 0,
            total_unread_mentions: 1,
        });
        expect(nextState.threadsInTeam.a).toContain('t1');
    });

    test('RECEIVED_THREADS should update the state', () => {
        const state = deepFreeze({
            threadsInTeam: {
                a: [],
            },
            threads: {},
            counts: {},
            countsIncludingDirect: {
                a: {
                    total: 3,
                    total_unread_threads: 0,
                    total_unread_mentions: 1,
                },
            },
        });

        const nextState = threadsReducer(state, {
            type: ThreadTypes.RECEIVED_THREAD_COUNTS,
            data: {
                team_id: 'a',
                threads: null,
                total: 0,
                total_unread_threads: 0,
                total_unread_mentions: 0,
            },
        });

        expect(nextState).not.toBe(state);
        expect(nextState.threads).toBe(state.threads);
        expect(nextState.threadsInTeam).toBe(state.threadsInTeam);
        expect(nextState.counts.a).toBe(state.counts.a);
        expect(nextState.countsIncludingDirect.a).toEqual({
            total: 0,
            total_unread_threads: 0,
            total_unread_mentions: 0,
        });
    });

    test('RECEIVED_UNREAD_THREADS should update the state', () => {
        const state = deepFreeze({
            threadsInTeam: {},
            unreadThreadsInTeam: {},
            threads: {},
            counts: {},
        });

        const nextState = threadsReducer(state, {
            type: ThreadTypes.RECEIVED_UNREAD_THREADS,
            data: {
                team_id: 'a',
                threads: [
                    {id: 't1'},
                ],
                total: 3,
                total_unread_threads: 0,
                total_unread_mentions: 1,
            },
        });

        expect(nextState).not.toBe(state);
        expect(nextState.threads.t1).toEqual({
            id: 't1',
        });
        expect(nextState.unreadThreadsInTeam.a).toContain('t1');
        expect(nextState.threadsInTeam).toBe(state.threadsInTeam);
    });

    test('ALL_TEAM_THREADS_READ should clear the counts', () => {
        const state = deepFreeze({
            threadsInTeam: {},
            unreadThreadsInTeam: {},
            threads: {},
            counts: {
                a: {
                    total: 3,
                    total_unread_threads: 0,
                    total_unread_mentions: 2,
                },
            },
        });
        const nextState2 = threadsReducer(state, {
            type: ThreadTypes.ALL_TEAM_THREADS_READ,
            data: {
                team_id: 'a',
            },
        });

        expect(nextState2).not.toBe(state);
        expect(nextState2.counts.a).toEqual({
            total: 3,
            total_unread_threads: 0,
            total_unread_mentions: 0,
            total_unread_urgent_mentions: 0,
        });
    });

    test('FOLLOW_CHANGED_THREAD should increment/decrement the total by 1', () => {
        const state = deepFreeze({
            threadsInTeam: {},
            unreadThreadsInTeam: {},
            threads: {},
            counts: {
                a: {
                    total: 3,
                    total_unread_threads: 0,
                    total_unread_mentions: 2,
                },
            },
            countsIncludingDirect: {
                a: {
                    total: 3,
                    total_unread_threads: 0,
                    total_unread_mentions: 2,
                },
            },
        });
        const nextState2 = threadsReducer(state, {
            type: ThreadTypes.FOLLOW_CHANGED_THREAD,
            data: {
                team_id: 'a',
                following: true,
            },
        });

        expect(nextState2).not.toBe(state);
        expect(nextState2.countsIncludingDirect.a).toEqual({
            total: 4,
            total_unread_threads: 0,
            total_unread_mentions: 2,
        });

        const nextState3 = threadsReducer(state, {
            type: ThreadTypes.FOLLOW_CHANGED_THREAD,
            data: {
                team_id: 'a',
                following: false,
            },
        });

        expect(nextState3).not.toBe(state);
        expect(nextState3.countsIncludingDirect.a).toEqual({
            total: 2,
            total_unread_threads: 0,
            total_unread_mentions: 2,
        });
    });

    test('READ_CHANGED_THREAD should update the count for thread per channel', () => {
        const state = deepFreeze({
            threadsInTeam: {
                a: ['id'],
            },
            unreadThreadsInTeam: {
                a: ['a', 'id', 'c'],
            },
            threads: {
                id: {
                    last_reply_at: 10,
                },
                a: {
                    last_reply_at: 10,
                },
                c: {
                    last_reply_at: 10,
                },
            },
            counts: {
                a: {
                    total: 3,
                    total_unread_threads: 1,
                    total_unread_mentions: 3,
                },
            },
            countsIncludingDirect: {
                a: {
                    total: 3,
                    total_unread_threads: 1,
                    total_unread_mentions: 3,
                },
            },
        });

        const nextState2 = threadsReducer(state, {
            type: ThreadTypes.READ_CHANGED_THREAD,
            data: {
                id: 'id',
                teamId: 'a',
                prevUnreadMentions: 3,
                newUnreadMentions: 0,
                channelId: 'a',
            },
        });

        expect(nextState2).not.toBe(state);
        expect(nextState2.counts.a).toEqual({
            total: 3,
            total_unread_threads: 1,
            total_unread_mentions: 0,
        });
        expect(nextState2.threadsInTeam.a).toEqual(['id']);
        expect(nextState2.unreadThreadsInTeam.a).toEqual(['a', 'c']);

        const nextState3 = threadsReducer(nextState2, {
            type: ThreadTypes.READ_CHANGED_THREAD,
            data: {
                id: 'id',
                teamId: 'a',
                prevUnreadMentions: 0,
                newUnreadMentions: 3,
                channelId: 'a',
            },
        });

        expect(nextState3).not.toBe(nextState2);
        expect(nextState3.threadsInTeam.a).toEqual(['id']);
        expect(nextState3.unreadThreadsInTeam.a).toEqual(['a', 'c']);
        expect(nextState3.counts.a).toEqual({
            total: 3,
            total_unread_threads: 1,
            total_unread_mentions: 3,
        });
        expect(nextState3.countsIncludingDirect.a).toEqual({
            total: 3,
            total_unread_threads: 1,
            total_unread_mentions: 3,
        });
    });
    test('LEAVE_TEAM should clean the state', () => {
        const state = deepFreeze({
            threadsInTeam: {},
            unreadThreadsInTeam: {},
            threads: {},
            counts: {},
        });

        let nextState = threadsReducer(state, {
            type: ThreadTypes.RECEIVED_THREADS,
            data: {
                team_id: 'a',
                threads: [
                    {id: 't1'},
                ],
                total: 3,
                total_unread_threads: 0,
                total_unread_mentions: 1,
            },
        });

        expect(nextState).not.toBe(state);

        // leave team
        nextState = threadsReducer(state, {
            type: TeamTypes.LEAVE_TEAM,
            data: {
                id: 'a',
            },
        });

        expect(nextState.threads.t1).toBe(undefined);
        expect(nextState.counts.a).toBe(undefined);
        expect(nextState.threadsInTeam.a).toBe(undefined);
    });

    test.each([PostTypes.POST_REMOVED, PostTypes.POST_DELETED])('%s should remove the thread when root post', (action) => {
        const state = deepFreeze({
            threadsInTeam: {
                a: ['t1', 't2', 't3'],
            },
            unreadThreadsInTeam: {
                a: ['t1', 't2', 't3'],
            },
            threads: {
                t1: {
                    id: 't1',
                },
                t2: {
                    id: 't2',
                },
                t3: {
                    id: 't3',
                },
            },
            counts: {},
            countsIncludingDirect: {},
        });

        const nextState = threadsReducer(state, {
            type: action,
            data: {id: 't2', root_id: ''},
        });

        expect(nextState).not.toBe(state);
        expect(nextState.threads.t2).toBe(undefined);
        expect(nextState.threadsInTeam.a).toEqual(['t1', 't3']);
        expect(nextState.unreadThreadsInTeam.a).toEqual(['t1', 't3']);
    });

    test.each([PostTypes.POST_REMOVED, PostTypes.POST_DELETED])('%s should remove the thread when root post from all teams', (action) => {
        const state = deepFreeze({
            threadsInTeam: {
                a: ['t1', 't2', 't3'],
                b: ['t2'],
            },
            unreadThreadsInTeam: {
                a: ['t1', 't2', 't3'],
                b: ['t2'],
            },
            threads: {
                t1: {
                    id: 't1',
                },
                t2: {
                    id: 't2',
                },
                t3: {
                    id: 't3',
                },
            },
            counts: {},
            countsIncludingDirect: {},
        });

        const nextState = threadsReducer(state, {
            type: action,
            data: {id: 't2', root_id: ''},
        });

        expect(nextState).not.toBe(state);
        expect(nextState.threads.t2).toBe(undefined);
        expect(nextState.threadsInTeam.a).toEqual(['t1', 't3']);
        expect(nextState.unreadThreadsInTeam.a).toEqual(['t1', 't3']);
        expect(nextState.threadsInTeam.b).toEqual([]);
        expect(nextState.unreadThreadsInTeam.b).toEqual([]);
    });

    test.each([PostTypes.POST_REMOVED, PostTypes.POST_DELETED])('%s should do nothing when not a root post', (action) => {
        const state = deepFreeze({
            threadsInTeam: {
                a: ['t1', 't2', 't3'],
            },
            unreadThreadsInTeam: {
                a: ['t1', 't2', 't3'],
            },
            threads: {
                t1: {
                    id: 't1',
                },
                t2: {
                    id: 't2',
                },
                t3: {
                    id: 't3',
                },
            },
            counts: {},
            countsIncludingDirect: {},
        });

        const nextState = threadsReducer(state, {
            type: action,
            data: {id: 't2', root_id: 't1'},
        });

        expect(nextState).toBe(state);
        expect(nextState.threads.t2).toBe(state.threads.t2);
        expect(nextState.threadsInTeam.a).toEqual(['t1', 't2', 't3']);
        expect(nextState.unreadThreadsInTeam.a).toEqual(['t1', 't2', 't3']);
    });

    test.each([PostTypes.POST_REMOVED, PostTypes.POST_DELETED])('%s should do nothing when post not exist', (action) => {
        const state = deepFreeze({
            threadsInTeam: {
                a: ['t1', 't2'],
            },
            unreadThreadsInTeam: {
                a: ['t1', 't2'],
            },
            threads: {
                t1: {
                    id: 't1',
                },
                t2: {
                    id: 't2',
                },
            },
            counts: {},
            countsIncludingDirect: {},
        });

        const nextState = threadsReducer(state, {
            type: action,
            data: {id: 't3', root_id: ''},
        });

        expect(nextState).toBe(state);
        expect(nextState.threads.t2).toBe(state.threads.t2);
        expect(nextState.threadsInTeam.a).toEqual(['t1', 't2']);
        expect(nextState.unreadThreadsInTeam.a).toEqual(['t1', 't2']);
    });

    test('LEAVE_CHANNEL should remove threads that belong to that channel', () => {
        const state = deepFreeze({
            threadsInTeam: {
                a: ['t1', 't2', 't3'],
                b: ['t4', 't5', 't6'],
            },
            unreadThreadsInTeam: {
                a: ['t1', 't2', 't3'],
                b: ['t4', 't5', 't6'],
            },
            threads: {
                t0: {
                    id: 't0',
                    unread_replies: 0,
                    unread_mentions: 0,
                    post: {
                        channel_id: 'ch1',
                    },
                },
                t1: {
                    id: 't1',
                    unread_replies: 1,
                    unread_mentions: 0,
                    post: {
                        channel_id: 'ch2',
                    },
                },
                t2: {
                    id: 't2',
                    unread_replies: 1,
                    unread_mentions: 1,
                    post: {
                        channel_id: 'ch1',
                    },
                },
                t3: {
                    id: 't3',
                    unread_replies: 2,
                    unread_mentions: 1,
                    post: {
                        channel_id: 'ch1',
                    },
                },
                t4: {
                    id: 't4',
                    unread_replies: 1,
                    unread_mentions: 0,
                    post: {
                        channel_id: 'ch3',
                    },
                },
                t5: {
                    id: 't5',
                    unread_replies: 1,
                    unread_mentions: 1,
                    post: {
                        channel_id: 'ch4',
                    },
                },
                t6: {
                    id: 't6',
                    unread_replies: 0,
                    unread_mentions: 0,
                    post: {
                        channel_id: 'ch5',
                    },
                },
            },
            counts: {
                a: {
                    total: 4,
                    total_unread_threads: 3,
                    total_unread_mentions: 2,
                },
                b: {
                    total: 3,
                    total_unread_threads: 2,
                    total_unread_mentions: 0,
                },
            },
            countsIncludingDirect: {
                a: {
                    total: 4,
                    total_unread_threads: 3,
                    total_unread_mentions: 2,
                },
                b: {
                    total: 3,
                    total_unread_threads: 2,
                    total_unread_mentions: 0,
                },
            },
        });

        const nextState = threadsReducer(state, {
            type: ChannelTypes.LEAVE_CHANNEL,
            data: {id: 'ch1', team_id: 'a'},
        });

        expect(nextState).not.toBe(state);

        expect(nextState.threads).toEqual({
            t1: state.threads.t1,
            t4: state.threads.t4,
            t5: state.threads.t5,
            t6: state.threads.t6,
        });

        expect(nextState.threadsInTeam.a).toEqual(['t1']);
        expect(nextState.unreadThreadsInTeam.a).toEqual(['t1']);

        expect(nextState.counts.a).toEqual({
            total: 1,
            total_unread_threads: 1,
            total_unread_mentions: 0,
            total_unread_urgent_mentions: 0,
        });

        expect(nextState.countsIncludingDirect.a).toEqual({
            total: 1,
            total_unread_threads: 1,
            total_unread_mentions: 0,
            total_unread_urgent_mentions: 0,
        });

        expect(nextState.threadsInTeam.b).toBe(state.threadsInTeam.b);
        expect(nextState.counts.b).toBe(state.counts.b);
        expect(nextState.countsIncludingDirect.b).toBe(state.countsIncludingDirect.b);
    });

    describe('RECEIVED_THREAD', () => {
        const state = deepFreeze({
            threadsInTeam: {
                a: ['t1', 't2'],
                b: ['t1'],
                c: [],
            },
            unreadThreadsInTeam: {
                a: ['t2'],
                b: [],
                c: [],
            },
            threads: {
                t1: {
                    id: 't1',
                    last_reply_at: 10,
                },
                t2: {
                    id: 't2',
                    last_reply_at: 20,
                },
            },
            counts: {},
            countsIncludingDirect: {},
        });

        test.each([
            ['a', {id: 't3', last_reply_at: 40, unread_mentions: 0, unread_replies: 0}, {a: {all: ['t1', 't2', 't3'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't3', last_reply_at: 40, unread_mentions: 1, unread_replies: 1}, {a: {all: ['t1', 't2', 't3'], unread: ['t2', 't3']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't3', last_reply_at: 40, unread_mentions: 0, unread_replies: 1}, {a: {all: ['t1', 't2', 't3'], unread: ['t2', 't3']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't3', last_reply_at: 5, unread_mentions: 0, unread_replies: 0}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't3', last_reply_at: 5, unread_mentions: 1, unread_replies: 1}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't2', last_reply_at: 40, unread_mentions: 0, unread_replies: 0}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't2', last_reply_at: 40, unread_mentions: 1, unread_replies: 1}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't2', last_reply_at: 40, unread_mentions: 0, unread_replies: 1}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't2', last_reply_at: 5, unread_mentions: 0, unread_replies: 0}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            ['a', {id: 't2', last_reply_at: 5, unread_mentions: 1, unread_replies: 1}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],

            // DM/GM threads
            [undefined, {id: 't3', last_reply_at: 40, unread_mentions: 0, unread_replies: 0}, {a: {all: ['t1', 't2', 't3'], unread: ['t2']}, b: {all: ['t1', 't3'], unread: []}}],
            [undefined, {id: 't3', last_reply_at: 40, unread_mentions: 1, unread_replies: 1}, {a: {all: ['t1', 't2', 't3'], unread: ['t2', 't3']}, b: {all: ['t1', 't3'], unread: []}}],
            [undefined, {id: 't3', last_reply_at: 40, unread_mentions: 0, unread_replies: 1}, {a: {all: ['t1', 't2', 't3'], unread: ['t2', 't3']}, b: {all: ['t1', 't3'], unread: []}}],
            [undefined, {id: 't3', last_reply_at: 5, unread_mentions: 0, unread_replies: 0}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            [undefined, {id: 't3', last_reply_at: 5, unread_mentions: 1, unread_replies: 1}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            [undefined, {id: 't2', last_reply_at: 40, unread_mentions: 0, unread_replies: 0}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1', 't2'], unread: []}}],
            [undefined, {id: 't2', last_reply_at: 40, unread_mentions: 1, unread_replies: 1}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1', 't2'], unread: []}}],
            [undefined, {id: 't2', last_reply_at: 40, unread_mentions: 0, unread_replies: 1}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1', 't2'], unread: []}}],
            [undefined, {id: 't2', last_reply_at: 5, unread_mentions: 0, unread_replies: 0}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
            [undefined, {id: 't2', last_reply_at: 5, unread_mentions: 1, unread_replies: 1}, {a: {all: ['t1', 't2'], unread: ['t2']}, b: {all: ['t1'], unread: []}}],
        ])('should handle "%s" team and thread %o', (teamId, thread, expected) => {
            const nextState = threadsReducer(state, {
                type: ThreadTypes.RECEIVED_THREAD,
                data: {
                    thread,
                    team_id: teamId,
                },
            });

            // team a
            expect(nextState.threadsInTeam.a).toEqual(expected.a.all);
            expect(nextState.unreadThreadsInTeam.a).toEqual(expected.a.unread);

            // team b
            expect(nextState.threadsInTeam.b).toEqual(expected.b.all);
            expect(nextState.unreadThreadsInTeam.b).toEqual(expected.b.unread);

            // team c
            expect(nextState.threadsInTeam.c).toEqual([]);
            expect(nextState.unreadThreadsInTeam.c).toEqual([]);
        });
    });

    describe('unreadThreadsInTeam should handle READ_CHANGED_THREAD', () => {
        const state = deepFreeze({
            threadsInTeam: {
                a: ['t1', 't2'],
            },
            unreadThreadsInTeam: {
                a: ['t2'],
            },
            threads: {
                t1: {
                    id: 't1',
                    last_reply_at: 10,
                },
                t2: {
                    id: 't2',
                    last_reply_at: 20,
                },
                t3: {
                    id: 't3',
                    last_reply_at: 30,
                },
            },
            counts: {},
            countsIncludingDirect: {},
        });

        test.each([
            [{id: 't1', teamId: 'a', mentions: 0, replies: 0}, ['t2']],
            [{id: 't1', teamId: 'a', mentions: 1, replies: 0}, ['t2']],
            [{id: 't2', teamId: 'a', mentions: 0, replies: 0}, []],
            [{id: 't2', teamId: 'a', mentions: 1, replies: 1}, ['t2']],
            [{id: 't3', teamId: 'a', mentions: 1, replies: 1}, ['t2', 't3']],
            [{id: 't4', teamId: 'a', mentions: 1, replies: 1}, ['t2']],
        ])('should handle thread %o', ({id, teamId, mentions, replies}, expected) => {
            const nextState = threadsReducer(state, {
                type: ThreadTypes.READ_CHANGED_THREAD,
                data: {
                    id,
                    teamId,
                    newUnreadMentions: mentions,
                    newUnreadReplies: replies,
                },
            });
            expect(nextState.unreadThreadsInTeam.a).toEqual(expected);
        });
    });
});
