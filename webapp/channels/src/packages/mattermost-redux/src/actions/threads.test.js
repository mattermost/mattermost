// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {
    getThread as fetchThread,
    getThreads as fetchThreads,
    getThreadCounts as fetchThreadCounts,
} from 'mattermost-redux/actions/threads';

import {
    getThread,
    getThreadsInCurrentTeam,
    getThreadCountsInCurrentTeam,
} from 'mattermost-redux/selectors/entities/threads';

import {Client4} from 'mattermost-redux/client';

import TestHelper from 'mattermost-redux/test/test_helper';
import configureStore from 'mattermost-redux/test/test_store';

const ID_PAD = 'a0b1c2z9n7';

/**
 * Returns a mock thread with 2 participants and 5 replies.
 */
function mockUserThread({
    uniq = 0,
    userId = `uid${uniq}`.padEnd(26, ID_PAD),
    otherUserId = `uid${uniq + 1}`.padEnd(26, ID_PAD),
    channelId = `cid${uniq}`.padEnd(26, ID_PAD),
    postId = `pid${uniq}`.padEnd(26, ID_PAD),
} = {}) {
    const threadId = postId;

    /**
     * @type {import('../types/threads').UserThread}
     */
    const thread = {
        id: threadId,
        reply_count: 5,
        last_reply_at: 1611786714949,
        last_viewed_at: 1611786716048,
        participants: [
            {id: userId},
            {id: otherUserId},
        ],
        post: {
            id: postId,
            create_at: 1610486901110,
            update_at: 1611786714912,
            edit_at: 0,
            delete_at: 0,
            is_pinned: false,
            user_id: userId,
            channel_id: channelId,
            root_id: '',
            original_id: '',
            message: `accusamus incidunt ab quidem fuga. postId: ${postId}`,
            type: '',
            props: {},
            hashtags: '',
            pending_post_id: '',
            reply_count: 0,
            last_reply_at: 0,
            participants: null,
        },
        unread_replies: 0,
        unread_mentions: 0,
    };

    return [thread, {userId, otherUserId, channelId, postId, threadId}];
}

describe('Actions.Threads', () => {
    let store;
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    const currentTeamId = 'currentTeamId'.padEnd(26, ID_PAD);
    const currentUserId = 'currentUserId'.padEnd(26, ID_PAD);
    const channel = TestHelper.fakeChannelWithId(currentTeamId);

    beforeEach(() => {
        store = configureStore({
            entities: {
                teams: {
                    currentTeamId,
                },
                users: {
                    currentUserId,
                },
                channels: {
                    channelsInTeam: {
                        [currentTeamId]: [channel.id],
                    },
                    channels: {
                        [channel.id]: channel,
                    },
                    myMembers: {
                        [channel.id]: {},
                    },
                },
            },
        });
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    test('getThread', async () => {
        const [mockThread, {threadId}] = mockUserThread({channelId: channel.id});

        nock(Client4.getBaseRoute()).
            get((uri) => uri.includes(`/users/${currentUserId}/teams/${currentTeamId}/threads/${threadId}`)).
            reply(200, mockThread);

        const {error, data} = await store.dispatch(fetchThread(currentUserId, currentTeamId, threadId, false));
        const state = store.getState();
        const thread = getThread(state, threadId);
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(thread).toEqual({...mockThread, is_following: true});
    });

    test('getThreads', async () => {
        const [mockThread0, {threadId: threadId0}] = mockUserThread({uniq: 0});
        const [mockThread1, {threadId: threadId1}] = mockUserThread({uniq: 1});
        const [mockThread2, {threadId: threadId2}] = mockUserThread({uniq: 2});

        const mockResponse = {
            threads: [mockThread0, mockThread1, mockThread2],
            total: 0,
            total_unread_mentions: 0,
            total_unread_threads: 0,
        };

        nock(Client4.getBaseRoute()).
            get((uri) => uri.includes(`/users/${currentUserId}/teams/${currentTeamId}/threads`)).
            reply(200, mockResponse);

        const {error, data} = await store.dispatch(fetchThreads(currentUserId, currentTeamId));
        const state = store.getState();
        const threads = getThreadsInCurrentTeam(state);
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(threads).toEqual([threadId0, threadId1, threadId2]);
    });

    test('getThreadCounts', async () => {
        const mockResponse = {
            threads: null,
            total: 3,
            total_unread_mentions: 1,
            total_unread_threads: 2,
        };

        nock(Client4.getBaseRoute()).
            get((uri) => uri.includes(`/users/${currentUserId}/teams/${currentTeamId}/threads`)).
            reply(200, mockResponse);

        const {error, data} = await store.dispatch(fetchThreadCounts(currentUserId, currentTeamId));
        const state = store.getState();
        const counts = getThreadCountsInCurrentTeam(state);
        expect(error).toBeUndefined();
        expect(data).toBeDefined();
        expect(counts).toEqual({
            total: 3,
            total_unread_mentions: 1,
            total_unread_threads: 2,
        });
    });
});
