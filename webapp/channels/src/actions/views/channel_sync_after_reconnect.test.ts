// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {Post, PostList} from '@mattermost/types/posts';

import {GeneralTypes} from 'mattermost-redux/action_types';
import {receivedNewPost} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import {getRecentPostsChunkInChannel} from 'mattermost-redux/selectors/entities/posts';

import {loadLatestPosts, loadPosts, loadPostsAround, loadUnreads, syncPostsInChannel} from 'actions/views/channel';
import configureStore from 'store';

import {PostRequestTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

const channelId = 'channel1';
const userId = 'user1';

const LOADED_AT = 1000;
const DISCONNECTED_AT = 2000;
const RECONNECTED_AT = 2100;

function makePost(id: string, createAt: number, rootId = 'root'): Post {
    return TestHelper.getPostMock({id, channel_id: channelId, user_id: userId, root_id: rootId, create_at: createAt, update_at: createAt});
}

const oldest = makePost('oldest', 50, '');
const root = makePost('root', 100, '');
const older = makePost('older', 200);
const trim = makePost('trim', 900);
const missedWhileAsleep = makePost('missed', 1500);
const liveAfterReconnect = makePost('live', 2120);

const serverPosts = [liveAfterReconnect, missedWhileAsleep, trim, older, root, oldest];
const expectedRecentOrder = ['live', 'missed', 'trim', 'older', 'root', 'oldest'];

function postList(posts: Post[], {next = '', prev = ''} = {}): PostList {
    return {
        order: posts.map((p) => p.id),
        posts: Object.fromEntries(posts.map((p) => [p.id, p])),
        next_post_id: next,
        prev_post_id: prev,
        first_inaccessible_post_time: 0,
    };
}

type Store = ReturnType<typeof configureStore>;

function setupStore(unreadScrollPosition = Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT) {
    const store = configureStore({
        entities: {
            general: {config: {CollapsedThreads: 'default_off'}},
            users: {currentUserId: userId, profiles: {[userId]: TestHelper.getUserMock({id: userId})}},
            channels: {currentChannelId: 'town-square'},
            preferences: {
                myPreferences: TestHelper.getPreferencesMock([
                    {category: Preferences.CATEGORY_ADVANCED_SETTINGS, name: Preferences.UNREAD_SCROLL_POSITION, value: unreadScrollPosition},
                ], userId),
            },
        },
    });
    store.dispatch({type: GeneralTypes.WEBSOCKET_SUCCESS, timestamp: 0});
    return store;
}

const server = () => nock(Client4.getBaseRoute());

describe('syncing a channel after a websocket reconnect', () => {
    let now: jest.SpyInstance;

    beforeAll(() => {
        Client4.setUrl('http://localhost:8065');
    });

    beforeEach(() => {
        now = jest.spyOn(Date, 'now');
    });

    afterEach(() => {
        now.mockRestore();
        nock.cleanAll();
    });

    // The socket drops (the laptop sleeps), a reply is posted and lost, the socket comes back with a new
    // connection so nothing is replayed, and a later reply arrives live while the user is in another channel.
    function sleepAndWake(store: Store) {
        store.dispatch({type: GeneralTypes.WEBSOCKET_FAILURE, timestamp: DISCONNECTED_AT});
        store.dispatch({type: GeneralTypes.WEBSOCKET_SUCCESS, timestamp: RECONNECTED_AT});
        store.dispatch(receivedNewPost(liveAfterReconnect, false));
    }

    // Switching back to the channel makes PostList sync it from the newest post it has.
    async function switchBackToChannel(store: Store) {
        server().
            get(`/channels/${channelId}/posts`).
            query((q) => q.since !== undefined).
            reply(200, (uri) => {
                const since = Number(new URL(uri, 'http://localhost').searchParams.get('since'));
                return postList(serverPosts.filter((p) => p.update_at > since));
            });
        now.mockReturnValue(3000);
        await store.dispatch(syncPostsInChannel(channelId, liveAfterReconnect.create_at));

        return getRecentPostsChunkInChannel(store.getState(), channelId)?.order;
    }

    // Each load ends with the channel's newest posts; onLastResponse runs while its last request is in flight.
    const loadsReachingNewestPosts = [
        {
            name: 'loading unreads starting from the newest',
            unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_NEWEST,
            load: async (store: Store, onLastResponse: () => void) => {
                server().
                    get(`/users/${userId}/channels/${channelId}/posts/unread`).query(true).
                    reply(200, postList([older, root, oldest], {next: trim.id})).
                    get(`/channels/${channelId}/posts`).query((q) => q.page === '0').
                    reply(200, () => {
                        onLastResponse();
                        return postList([trim, older, root, oldest]);
                    });
                now.mockReturnValue(LOADED_AT);
                await store.dispatch(loadUnreads(channelId));
            },
        },
        {
            name: 'scrolling down to them',
            unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT,
            load: async (store: Store, onLastResponse: () => void) => {
                server().
                    get(`/users/${userId}/channels/${channelId}/posts/unread`).query(true).
                    reply(200, postList([older, root, oldest], {next: trim.id}));
                await store.dispatch(loadUnreads(channelId));

                server().
                    get(`/channels/${channelId}/posts`).query((q) => q.after === older.id).
                    reply(200, () => {
                        onLastResponse();
                        return postList([trim], {prev: older.id});
                    });
                now.mockReturnValue(LOADED_AT);
                await store.dispatch(loadPosts({channelId, postId: older.id, type: PostRequestTypes.AFTER_ID, perPage: 30}));
            },
        },
        {
            name: 'opening a permalink',
            unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT,
            load: async (store: Store, onLastResponse: () => void) => {
                server().
                    get(`/channels/${channelId}/posts`).query((q) => q.after === trim.id).
                    reply(200, () => {
                        onLastResponse();
                        return postList([]);
                    }).
                    get(`/posts/${trim.id}/thread`).query(true).
                    reply(200, postList([trim, root])).
                    get(`/channels/${channelId}/posts`).query((q) => q.before === trim.id).
                    reply(200, postList([older, root, oldest], {next: trim.id}));
                now.mockReturnValue(LOADED_AT);
                await store.dispatch(loadPostsAround(channelId, trim.id));
            },
        },
        {
            name: 'syncing the channel',
            unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT,
            load: async (store: Store, onLastResponse: () => void) => {
                server().
                    get(`/channels/${channelId}/posts`).query((q) => q.page === '0').
                    reply(200, postList([older, root, oldest])).
                    get(`/channels/${channelId}/posts`).query((q) => q.since === String(older.create_at)).
                    reply(200, () => {
                        onLastResponse();
                        return postList([trim]);
                    });
                now.mockReturnValue(LOADED_AT - 500);
                await store.dispatch(loadLatestPosts(channelId));

                now.mockReturnValue(LOADED_AT);
                await store.dispatch(syncPostsInChannel(channelId, older.create_at));
            },
        },
    ];

    test.each(loadsReachingNewestPosts)('includes the missed reply when the newest posts came from $name', async ({unreadScrollPosition, load}) => {
        const store = setupStore(unreadScrollPosition);
        await load(store, () => {});

        sleepAndWake(store);

        expect(await switchBackToChannel(store)).toEqual(expectedRecentOrder);
    });

    test.each(loadsReachingNewestPosts)('includes the missed reply when the socket dropped while $name', async ({unreadScrollPosition, load}) => {
        const store = setupStore(unreadScrollPosition);
        await load(store, () => {
            store.dispatch({type: GeneralTypes.WEBSOCKET_FAILURE, timestamp: DISCONNECTED_AT});
            now.mockReturnValue(DISCONNECTED_AT + 50);
        });

        sleepAndWake(store);

        expect(await switchBackToChannel(store)).toEqual(expectedRecentOrder);
    });

    // None of these loads reach the newest posts, so loading them after reconnecting must not count as
    // having caught up on what was missed while disconnected.
    const loadsNotReachingNewestPosts = [
        {
            name: 'opening a permalink to an older post',
            load: async (store: Store) => {
                // The after page stands in for a full page with more posts following it
                server().
                    get(`/channels/${channelId}/posts`).query((q) => q.after === older.id).
                    reply(200, postList([trim], {next: missedWhileAsleep.id, prev: older.id})).
                    get(`/posts/${older.id}/thread`).query(true).
                    reply(200, postList([older, root])).
                    get(`/channels/${channelId}/posts`).query((q) => q.before === older.id).
                    reply(200, postList([root, oldest], {next: older.id}));
                await store.dispatch(loadPostsAround(channelId, older.id));
            },
        },
        {
            name: 'scrolling down without reaching the newest posts',
            load: async (store: Store) => {
                server().
                    get(`/channels/${channelId}/posts`).query((q) => q.after === older.id).
                    reply(200, postList([trim], {next: missedWhileAsleep.id, prev: older.id}));
                await store.dispatch(loadPosts({channelId, postId: older.id, type: PostRequestTypes.AFTER_ID, perPage: 1}));
            },
        },
        {
            name: 'scrolling up to the oldest posts',
            load: async (store: Store) => {
                server().
                    get(`/channels/${channelId}/posts`).query((q) => q.before === older.id).
                    reply(200, postList([root, oldest], {next: older.id}));
                await store.dispatch(loadPosts({channelId, postId: older.id, type: PostRequestTypes.BEFORE_ID, perPage: 30}));
            },
        },
    ];

    test.each(loadsNotReachingNewestPosts)('includes the missed reply after $name between reconnecting and switching back', async ({load}) => {
        const store = setupStore();
        server().
            get(`/channels/${channelId}/posts`).query((q) => q.page === '0').
            reply(200, postList([trim, older, root, oldest]));
        now.mockReturnValue(LOADED_AT);
        await store.dispatch(loadLatestPosts(channelId));

        sleepAndWake(store);

        now.mockReturnValue(RECONNECTED_AT + 50);
        await load(store);

        expect(await switchBackToChannel(store)).toEqual(expectedRecentOrder);
    });
});
