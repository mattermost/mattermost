// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {Post} from '@mattermost/types/posts';
import type {SearchParameter} from '@mattermost/types/search';

import {PostTypes, PreferenceTypes} from 'mattermost-redux/action_types';
import * as Actions from 'mattermost-redux/actions/search';
import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.Search', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    function flaggedPostsStore() {
        const channelId = TestHelper.basicChannel!.id;
        const userId = TestHelper.basicUser!.id;
        return configureStore({
            entities: {
                channels: {
                    channels: {[channelId]: TestHelper.basicChannel!},
                    myMembers: {[channelId]: TestHelper.basicChannelMember!},
                    membersInChannel: {[channelId]: {}},
                },
                users: {currentUserId: userId, statuses: {[userId]: 'online'}},
            },
        });
    }

    function mockFlaggedPage(before: string | undefined, order: Post[], hasNext: boolean, delay = 0) {
        nock(Client4.getUsersRoute()).
            get(`/${TestHelper.basicUser!.id}/posts/flagged`).
            query((query) => query.before === before).
            delay(delay).
            reply(200, {order: order.map((p) => p.id), posts: Object.fromEntries(order.map((p) => [p.id, p])), has_next: hasNext});
    }

    function flaggedPost(id: string) {
        return TestHelper.getPostMock({id, channel_id: TestHelper.basicChannel!.id, user_id: TestHelper.basicUser!.id});
    }

    it('getFlaggedPosts continues from the last post of the previous page', async () => {
        const userId = TestHelper.basicUser!.id;
        store = flaggedPostsStore();
        const {dispatch, getState} = store;
        const post1 = flaggedPost('post1');
        const post2 = flaggedPost('post2');

        nock(Client4.getUsersRoute()).
            get(`/${userId}/posts/flagged`).
            query((query) => query.before === undefined).
            reply(200, {order: [post1.id], posts: {[post1.id]: post1}, has_next: true});

        await dispatch(Actions.getFlaggedPosts());
        expect(getState().entities.search.flaggedPaging).toEqual({before: post1.id, isEnd: false});

        nock(Client4.getUsersRoute()).
            get(`/${userId}/posts/flagged`).
            query((query) => query.before === post1.id).
            reply(200, {order: [post2.id], posts: {[post2.id]: post2}, has_next: false});

        await dispatch(Actions.getFlaggedPosts(post1.id));
        expect(getState().entities.search.flagged).toEqual([post1.id, post2.id]);
        expect(getState().entities.search.flaggedPaging).toEqual({before: post2.id, isEnd: true});
    });

    it('getFlaggedPosts continues from a cursor post that was unsaved and removed', async () => {
        store = flaggedPostsStore();
        const {dispatch, getState} = store;
        const post1 = flaggedPost('post1');
        const post2 = flaggedPost('post2');

        mockFlaggedPage(undefined, [post1], true);
        await dispatch(Actions.getFlaggedPosts());

        dispatch({
            type: PreferenceTypes.DELETED_PREFERENCES,
            data: [{user_id: TestHelper.basicUser!.id, category: Preferences.CATEGORY_FLAGGED_POST, name: post1.id, value: 'true'}],
        });
        dispatch({type: PostTypes.POST_REMOVED, data: post1});
        expect(getState().entities.search.flagged).toEqual([]);

        mockFlaggedPage(post1.id, [post2], false);
        await dispatch(Actions.getFlaggedPosts(getState().entities.search.flaggedPaging.before));

        expect(getState().entities.search.flagged).toEqual([post2.id]);
        expect(getState().entities.search.flaggedPaging).toEqual({before: post2.id, isEnd: true});
        expect(nock.isDone()).toBe(true);
    });

    describe('getFlaggedPosts reloading while a later page is in flight', () => {
        async function race(reloadDelay: number, moreDelay: number) {
            const post1 = flaggedPost('post1');
            const post2 = flaggedPost('post2');
            store = flaggedPostsStore();
            mockFlaggedPage(undefined, [post1], true);
            await store.dispatch(Actions.getFlaggedPosts());

            mockFlaggedPage(post1.id, [post2], true, moreDelay);
            mockFlaggedPage(undefined, [post1], true, reloadDelay);
            await Promise.all([
                store.dispatch(Actions.getFlaggedPosts(post1.id)),
                store.dispatch(Actions.getFlaggedPosts()),
            ]);
            expect(nock.isDone()).toBe(true);
            return store.getState().entities.search;
        }

        it('keeps the later page when the reload lands first', async () => {
            const {flagged, flaggedPaging} = await race(0, 50);

            expect(flagged).toEqual(['post1', 'post2']);
            expect(flaggedPaging).toEqual({before: 'post2', isEnd: false});
        });

        it('restarts from the reload when it lands last', async () => {
            const {flagged, flaggedPaging} = await race(50, 0);

            expect(flagged).toEqual(['post1']);
            expect(flaggedPaging).toEqual({before: 'post1', isEnd: false});
        });
    });

    it('getMissingFlaggedPosts loads only the saved posts not already loaded', async () => {
        const channelId = TestHelper.basicChannel!.id;
        const userId = TestHelper.basicUser!.id;
        store = configureStore({
            entities: {
                channels: {
                    channels: {[channelId]: TestHelper.basicChannel!},
                    myMembers: {[channelId]: TestHelper.basicChannelMember!},
                    membersInChannel: {[channelId]: {}},
                },
                posts: {posts: {loaded: TestHelper.getPostMock({id: 'loaded'})}},
                users: {currentUserId: userId, statuses: {[userId]: 'online'}},
            },
        });
        const missing = TestHelper.getPostMock({id: 'missing', channel_id: channelId, user_id: userId});

        nock(Client4.getPostsRoute()).
            post('/ids', ['missing']).
            reply(200, [missing]);

        await store.dispatch(Actions.getMissingFlaggedPosts(['loaded', 'missing']));

        expect(store.getState().entities.posts.posts.missing).toEqual(missing);
        expect(nock.isDone()).toBe(true);
    });

    it('Perform Search', async () => {
        const {dispatch, getState} = store;

        let post1 = {
            ...TestHelper.fakePost(TestHelper.basicChannel!.id),
            message: 'try searching for this using the first and last word',
        };

        let post2 = {
            ...TestHelper.fakePost(TestHelper.basicChannel!.id),
            message: 'return this message in second attempt',
        };

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, {...post1, id: TestHelper.generateId()});
        post1 = await Client4.createPost(post1);

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, {...post2, id: TestHelper.generateId()});
        post2 = await Client4.createPost(post2);

        // Test for a couple of words
        const search1 = 'try word';

        nock(Client4.getTeamsRoute()).
            post(`/${TestHelper.basicTeam!.id}/posts/search`).
            reply(200, {order: [post1.id], posts: {[post1.id]: post1}});
        nock(Client4.getChannelsRoute()).
            get(`/${TestHelper.basicChannel!.id}/members/me`).
            reply(201, {user_id: TestHelper.basicUser!.id, channel_id: TestHelper.basicChannel!.id});

        await dispatch(Actions.searchPosts(TestHelper.basicTeam!.id, search1, false, false));

        let state = getState();
        let {results} = state.entities.search;
        const {posts} = state.entities.posts;
        let current = state.entities.search.current[TestHelper.basicTeam!.id];
        expect(results.length).toEqual(1);
        expect(posts[results[0]]).toBeTruthy();
        expect(!current.isEnd).toBeTruthy();

        // Search the next page and check the end of the search
        nock(Client4.getTeamsRoute()).
            post(`/${TestHelper.basicTeam!.id}/posts/search`).
            reply(200, {order: [], posts: {}});

        await dispatch(Actions.searchPostsWithParams(TestHelper.basicTeam!.id, {terms: search1, page: 1} as SearchParameter));
        state = getState();
        current = state.entities.search.current[TestHelper.basicTeam!.id];
        results = state.entities.search.results;
        expect(results.length).toEqual(1);
        expect(current.isEnd).toBeTruthy();
    });

    it('Perform Files Search', async () => {
        const {dispatch, getState} = store;

        const files = TestHelper.fakeFiles(2);
        (files[0] as any).channel_id = TestHelper.basicChannel!.id;
        (files[1] as any).channel_id = TestHelper.basicChannel!.id;

        // Test for a couple of words
        const search1 = 'try word';

        nock(Client4.getTeamsRoute()).
            post(`/${TestHelper.basicTeam!.id}/files/search`).
            reply(200, {order: [files[0].id], file_infos: {[files[0].id]: files[0]}});
        nock(Client4.getChannelsRoute()).
            get(`/${TestHelper.basicChannel!.id}/members/me`).
            reply(201, {user_id: TestHelper.basicUser!.id, channel_id: TestHelper.basicChannel!.id});

        await dispatch(Actions.searchFilesWithParams(TestHelper.basicTeam!.id, {terms: search1, is_or_search: false, include_deleted_channels: false, page: 0, per_page: Actions.WEBAPP_SEARCH_PER_PAGE}));

        let state = getState();
        let {fileResults} = state.entities.search;
        const {filesFromSearch} = state.entities.files;
        let current = state.entities.search.current[TestHelper.basicTeam!.id];
        expect(fileResults.length).toEqual(1);
        expect(filesFromSearch[fileResults[0]]).toBeTruthy();
        expect(!current.isFilesEnd).toBeTruthy();

        // Search the next page and check the end of the search
        nock(Client4.getTeamsRoute()).
            post(`/${TestHelper.basicTeam!.id}/files/search`).
            reply(200, {order: [], file_infos: {}});

        await dispatch(Actions.searchFilesWithParams(TestHelper.basicTeam!.id, {terms: search1, page: 1} as SearchParameter));
        state = getState();
        current = state.entities.search.current[TestHelper.basicTeam!.id];
        fileResults = state.entities.search.fileResults;
        expect(fileResults.length).toEqual(1);
        expect(current.isFilesEnd).toBeTruthy();
    });
});
