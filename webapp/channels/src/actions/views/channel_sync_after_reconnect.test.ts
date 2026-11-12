// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {Post, PostList} from '@mattermost/types/posts';

import {GeneralTypes} from 'mattermost-redux/action_types';
import {receivedNewPost} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import {getRecentPostsChunkInChannel} from 'mattermost-redux/selectors/entities/posts';

import {loadPosts, loadPostsAround, loadUnreads, syncPostsInChannel} from 'actions/views/channel';
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

const root = makePost('root', 100, '');
const older = makePost('older', 200);
const trim = makePost('trim', 900);
const missedWhileAsleep = makePost('missed', 1500);
const liveAfterReconnect = makePost('live', 2200);

const serverPosts = [liveAfterReconnect, missedWhileAsleep, trim, older, root];

function postList(posts: Post[], {next = '', prev = ''} = {}): PostList {
    return {
        order: posts.map((p) => p.id),
        posts: Object.fromEntries(posts.map((p) => [p.id, p])),
        next_post_id: next,
        prev_post_id: prev,
        first_inaccessible_post_time: 0,
    };
}

function mockGetPostsSince() {
    nock(Client4.getBaseRoute()).
        get(`/channels/${channelId}/posts`).
        query((q) => q.since !== undefined).
        reply(200, (uri) => {
            const since = Number(new URL(uri, 'http://localhost').searchParams.get('since'));
            return postList(serverPosts.filter((p) => p.update_at > since));
        });
}

function setupStore(unreadScrollPosition: string) {
    return configureStore({
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
}

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

    // The channel was last loaded at LOADED_AT, then the socket dropped (the laptop slept), a reply was posted
    // and lost, the socket came back with a new connection, and a later reply arrived live before the user
    // switched back to the channel.
    async function sleepWakeAndSwitchBack(store: ReturnType<typeof setupStore>) {
        store.dispatch({type: GeneralTypes.WEBSOCKET_FAILURE, timestamp: DISCONNECTED_AT});
        store.dispatch({type: GeneralTypes.WEBSOCKET_SUCCESS, timestamp: RECONNECTED_AT});
        store.dispatch(receivedNewPost(liveAfterReconnect, false));

        mockGetPostsSince();
        now.mockReturnValue(3000);
        await store.dispatch(syncPostsInChannel(channelId, liveAfterReconnect.create_at));

        return getRecentPostsChunkInChannel(store.getState(), channelId)?.order;
    }

    test('includes the missed reply when the newest posts came from loading unreads starting from the newest', async () => {
        const store = setupStore(Preferences.UNREAD_SCROLL_POSITION_START_FROM_NEWEST);
        store.dispatch({type: GeneralTypes.WEBSOCKET_SUCCESS, timestamp: 0});

        nock(Client4.getBaseRoute()).
            get(`/users/${userId}/channels/${channelId}/posts/unread`).query(true).
            reply(200, postList([older, root], {next: trim.id})).
            get(`/channels/${channelId}/posts`).query((q) => q.page === '0').
            reply(200, postList([trim, older, root]));
        now.mockReturnValue(LOADED_AT);
        await store.dispatch(loadUnreads(channelId));

        expect(await sleepWakeAndSwitchBack(store)).toEqual(['live', 'missed', 'trim', 'older', 'root']);
    });

    test('includes the missed reply when the newest posts came from scrolling down to them', async () => {
        const store = setupStore(Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT);
        store.dispatch({type: GeneralTypes.WEBSOCKET_SUCCESS, timestamp: 0});

        nock(Client4.getBaseRoute()).
            get(`/users/${userId}/channels/${channelId}/posts/unread`).query(true).
            reply(200, postList([older, root], {next: trim.id}));
        now.mockReturnValue(LOADED_AT - 500);
        await store.dispatch(loadUnreads(channelId));

        nock(Client4.getBaseRoute()).
            get(`/channels/${channelId}/posts`).query((q) => q.after === older.id).
            reply(200, postList([trim], {prev: older.id}));
        now.mockReturnValue(LOADED_AT);
        await store.dispatch(loadPosts({channelId, postId: older.id, type: PostRequestTypes.AFTER_ID, perPage: 30}));

        expect(await sleepWakeAndSwitchBack(store)).toEqual(['live', 'missed', 'trim', 'older', 'root']);
    });

    test('includes the missed reply when the newest posts came from opening a permalink', async () => {
        const store = setupStore(Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT);
        store.dispatch({type: GeneralTypes.WEBSOCKET_SUCCESS, timestamp: 0});

        nock(Client4.getBaseRoute()).
            get(`/channels/${channelId}/posts`).query((q) => q.after === trim.id).
            reply(200, postList([], {prev: trim.id})).
            get(`/posts/${trim.id}/thread`).query(true).
            reply(200, postList([trim, root])).
            get(`/channels/${channelId}/posts`).query((q) => q.before === trim.id).
            reply(200, postList([older, root], {next: trim.id}));
        now.mockReturnValue(LOADED_AT);
        await store.dispatch(loadPostsAround(channelId, trim.id));

        expect(await sleepWakeAndSwitchBack(store)).toEqual(['live', 'missed', 'trim', 'older', 'root']);
    });
});
