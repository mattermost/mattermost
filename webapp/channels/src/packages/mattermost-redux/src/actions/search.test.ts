// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {SearchParameter} from '@mattermost/types/search';

import * as Actions from 'mattermost-redux/actions/search';
import {Client4} from 'mattermost-redux/client';

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
