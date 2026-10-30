// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';
import type {RelationOneToMany} from '@mattermost/types/utilities';

import {ThreadTypes} from 'mattermost-redux/action_types';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {handleFollowChanged, unreadThreadsInTeamReducer} from './threadsInTeam';
import type {ExtraData} from './types';

describe('handleFollowChanged', () => {
    const state = deepFreeze({
        team_id1: ['id1_1', 'id1_2'],
        team_id2: ['id2_1', 'id2_2'],
    });

    const makeAction = (id: string, following: boolean) => ({
        type: ThreadTypes.FOLLOW_CHANGED_THREAD,
        data: {
            team_id: 'team_id1',
            id,
            following,
        },
    });

    const extra = {
        threads: {
            id1_0: {
                id: 'id1_0',
                last_reply_at: 0,
            },
            id1_1: {
                id: 'id1_1',
                last_reply_at: 10,
            },
            id1_2: {
                id: 'id1_1',
                last_reply_at: 20,
            },
            id1_3: {
                id: 'id1_3',
                last_reply_at: 30,
            },
            id2_1: {
                id: 'id2_1',
                last_reply_at: 100,
            },
            id2_2: {
                id: 'id2_2',
                last_reply_at: 200,
            },
        },
    } as unknown as ExtraData;

    test('follow existing thread', () => {
        const action = makeAction('id1_1', true);

        expect(handleFollowChanged(state, action, extra)).toEqual({
            team_id1: ['id1_1', 'id1_2'],
            team_id2: ['id2_1', 'id2_2'],
        });
    });

    test.each([
        ['id1_1', false, ['id1_2']],
        ['id1_3', false, ['id1_1', 'id1_2']],
        ['id1_1', true, ['id1_1', 'id1_2']],
        ['id1_3', true, ['id1_1', 'id1_2', 'id1_3']],
        ['id1_0', true, ['id1_1', 'id1_2']],
    ])('should return correct state for thread id %s and following state of %s', (id, following, expected) => {
        const action = makeAction(id, following);
        expect(handleFollowChanged(state, action, extra)).toEqual({
            team_id1: expected,
            team_id2: ['id2_1', 'id2_2'],
        });
    });
});

describe('unreadThreadsInTeam', () => {
    test('RECEIVED_THREADS should update the state if there are unread threads', () => {
        const state = deepFreeze({});
        const nextState: RelationOneToMany<Team, UserThread> = unreadThreadsInTeamReducer(state, {
            type: ThreadTypes.RECEIVED_THREADS,
            data: {
                team_id: 'a',
                threads: [
                    {id: 't1', unread_replies: 1},
                    {id: 't2', unread_mentions: 1},
                    {id: 't3'},
                ],
            },
        }, {threads: {}});

        expect(nextState).not.toBe(state);
        expect(nextState.a).toEqual(['t1', 't2']);
    });

    const unreadThread = {id: 't_new', unread_replies: 1, unread_mentions: 0, last_reply_at: 300} as UserThread;
    const threads = {
        t_old: {id: 't_old', last_reply_at: 100},
        t_mid: {id: 't_mid', last_reply_at: 200},
        t_new: unreadThread,
        t_newest: {id: 't_newest', last_reply_at: 400},
    };
    const extraWithThreads = {
        threads,
        threadsInTeam: {a: ['t_old', 't_mid']},
    } as unknown as ExtraData;

    test.each([
        ['empty', {a: []}],
        ['missing', {}],
    ])('RECEIVED_THREAD should add an unread thread newer than every followed thread when the unread list is %s', (_, initialState) => {
        const nextState: RelationOneToMany<Team, UserThread> = unreadThreadsInTeamReducer(deepFreeze(initialState), {
            type: ThreadTypes.RECEIVED_THREAD,
            data: {team_id: 'a', thread: unreadThread},
        }, extraWithThreads);

        expect(nextState.a).toEqual(['t_new']);
    });

    test('RECEIVED_THREAD should not add to an empty unread list when a followed thread is newer', () => {
        const state = deepFreeze({a: []});

        const nextState = unreadThreadsInTeamReducer(state, {
            type: ThreadTypes.RECEIVED_THREAD,
            data: {team_id: 'a', thread: unreadThread},
        }, {threads, threadsInTeam: {a: ['t_old', 't_newest']}} as unknown as ExtraData);

        expect(nextState).toBe(state);
    });

    test('RECEIVED_THREAD should not add to an empty unread list when no followed threads are loaded', () => {
        const state = deepFreeze({a: []});

        const nextState = unreadThreadsInTeamReducer(state, {
            type: ThreadTypes.RECEIVED_THREAD,
            data: {team_id: 'a', thread: unreadThread},
        }, {threads} as unknown as ExtraData);

        expect(nextState).toBe(state);
    });

    test('READ_CHANGED_THREAD should add the newest followed thread when it becomes unread and the unread list is empty', () => {
        const nextState: RelationOneToMany<Team, UserThread> = unreadThreadsInTeamReducer(deepFreeze({a: []}), {
            type: ThreadTypes.READ_CHANGED_THREAD,
            data: {id: 't_new', teamId: 'a', newUnreadReplies: 1, newUnreadMentions: 0},
        }, {threads, threadsInTeam: {a: ['t_old', 't_new']}} as unknown as ExtraData);

        expect(nextState.a).toEqual(['t_new']);
    });

    test('RECEIVED_THREAD should not add a thread older than every loaded thread', () => {
        const state = deepFreeze({a: ['t_mid']});
        const olderThread = {id: 't_old', unread_replies: 1, unread_mentions: 0, last_reply_at: 100} as UserThread;

        const nextState = unreadThreadsInTeamReducer(state, {
            type: ThreadTypes.RECEIVED_THREAD,
            data: {team_id: 'a', thread: olderThread},
        }, extraWithThreads);

        expect(nextState).toBe(state);
    });

    test('RECEIVED_THREAD should ignore loaded ids whose thread entity is missing', () => {
        const state = deepFreeze({a: ['t_gone']});

        const nextState = unreadThreadsInTeamReducer(state, {
            type: ThreadTypes.RECEIVED_THREAD,
            data: {team_id: 'a', thread: unreadThread},
        }, extraWithThreads);

        expect(nextState).toBe(state);
    });
});
