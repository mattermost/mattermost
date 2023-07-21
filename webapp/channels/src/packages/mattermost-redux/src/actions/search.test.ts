// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SearchParameter} from '@mattermost/types/search';
import nock from 'nock';

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

        await Actions.searchPosts(TestHelper.basicTeam!.id, search1, false, false)(dispatch, getState);

        let state = getState();
        let {recent, results} = state.entities.search;
        const {posts} = state.entities.posts;
        let current = state.entities.search.current[TestHelper.basicTeam!.id];
        expect(recent[TestHelper.basicTeam!.id]).toBeTruthy();
        let searchIsPresent = recent[TestHelper.basicTeam!.id].findIndex((r: {terms: string}) => r.terms === search1);
        expect(searchIsPresent !== -1).toBeTruthy();
        expect(Object.keys(recent[TestHelper.basicTeam!.id]).length).toEqual(1);
        expect(results.length).toEqual(1);
        expect(posts[results[0]]).toBeTruthy();
        expect(!current.isEnd).toBeTruthy();

        // Search the next page and check the end of the search
        nock(Client4.getTeamsRoute()).
            post(`/${TestHelper.basicTeam!.id}/posts/search`).
            reply(200, {order: [], posts: {}});

        await Actions.searchPostsWithParams(TestHelper.basicTeam!.id, {terms: search1, page: 1} as SearchParameter)(dispatch, getState);
        state = getState();
        current = state.entities.search.current[TestHelper.basicTeam!.id];
        recent = state.entities.search.recent;
        results = state.entities.search.results;
        expect(recent[TestHelper.basicTeam!.id]).toBeTruthy();
        searchIsPresent = recent[TestHelper.basicTeam!.id].findIndex((r: {terms: string}) => r.terms === search1);
        expect(searchIsPresent !== -1).toBeTruthy();
        expect(Object.keys(recent[TestHelper.basicTeam!.id]).length).toEqual(1);
        expect(results.length).toEqual(1);
        expect(current.isEnd).toBeTruthy();

        // DISABLED
        // Test for posts from a user in a channel
        //const search2 = `from: ${TestHelper.basicUser.username} in: ${TestHelper.basicChannel.name}`;

        //nock(Client4.getTeamsRoute(), `/${TestHelper.basicTeam.id}/posts/search`).
        //post(`/${TestHelper.basicTeam.id}/posts/search`).
        //reply(200, {order: [post1.id, post2.id, TestHelper.basicPost.id], posts: {[post1.id]: post1, [TestHelper.basicPost.id]: TestHelper.basicPost, [post2.id]: post2}});
        //nock(Client4.getChannelsRoute()).
        //get(`/${TestHelper.basicChannel.id}/members/me`).
        //reply(201, {user_id: TestHelper.basicUser.id, channel_id: TestHelper.basicChannel.id});
        //
        //await Actions.searchPosts(
        //TestHelper.basicTeam.id,
        //search2
        //)(dispatch, getState);
        //
        //state = getState();
        //recent = state.entities.search.recent;
        //results = state.entities.search.results;
        //searchIsPresent = recent[TestHelper.basicTeam.id].findIndex((r) => r.terms === search1);
        //expect(searchIsPresent !== -1).toBeTruthy();
        //expect(Object.keys(recent[TestHelper.basicTeam.id]).length).toEqual(2);
        //expect(results.length).toEqual(3);

        // Clear posts from the search store
        //await Actions.clearSearch()(dispatch, getState);
        //state = getState();
        //recent = state.entities.search.recent;
        //results = state.entities.search.results;
        //searchIsPresent = recent[TestHelper.basicTeam.id].findIndex((r) => r.terms === search1);
        //expect(searchIsPresent !== -1).toBeTruthy();
        //expect(Object.keys(recent[TestHelper.basicTeam.id]).length).toEqual(2);
        //expect(results.length).toEqual(0);

        // Clear a recent term
        //await Actions.removeSearchTerms(TestHelper.basicTeam.id, search2)(dispatch, getState);
        //state = getState();
        //recent = state.entities.search.recent;
        //results = state.entities.search.results;
        //searchIsPresent = recent[TestHelper.basicTeam.id].findIndex((r) => r.terms === search1);
        //expect(searchIsPresent !== -1).toBeTruthy();
        //searchIsPresent = recent[TestHelper.basicTeam.id].findIndex((r) => r.terms === search2);
        //expect(searchIsPresent === -1).toBeTruthy();
        //expect(Object.keys(recent[TestHelper.basicTeam.id]).length).toEqual(1);
        //expect(results.length).toEqual(0);
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

        await Actions.searchFiles(TestHelper.basicTeam!.id, search1, false, false)(dispatch, getState);

        let state = getState();
        let {recent, fileResults} = state.entities.search;
        const {filesFromSearch} = state.entities.files;
        let current = state.entities.search.current[TestHelper.basicTeam!.id];
        expect(recent[TestHelper.basicTeam!.id]).toBeTruthy();
        let searchIsPresent = recent[TestHelper.basicTeam!.id].findIndex((r: {terms: string}) => r.terms === search1);
        expect(searchIsPresent !== -1).toBeTruthy();
        expect(Object.keys(recent[TestHelper.basicTeam!.id]).length).toEqual(1);
        expect(fileResults.length).toEqual(1);
        expect(filesFromSearch[fileResults[0]]).toBeTruthy();
        expect(!current.isFilesEnd).toBeTruthy();

        // Search the next page and check the end of the search
        nock(Client4.getTeamsRoute()).
            post(`/${TestHelper.basicTeam!.id}/files/search`).
            reply(200, {order: [], file_infos: {}});

        await Actions.searchFilesWithParams(TestHelper.basicTeam!.id, {terms: search1, page: 1} as SearchParameter)(dispatch, getState);
        state = getState();
        current = state.entities.search.current[TestHelper.basicTeam!.id];
        recent = state.entities.search.recent;
        fileResults = state.entities.search.fileResults;
        expect(recent[TestHelper.basicTeam!.id]).toBeTruthy();
        searchIsPresent = recent[TestHelper.basicTeam!.id].findIndex((r: {terms: string}) => r.terms === search1);
        expect(searchIsPresent !== -1).toBeTruthy();
        expect(Object.keys(recent[TestHelper.basicTeam!.id]).length).toEqual(1);
        expect(fileResults.length).toEqual(1);
        expect(current.isFilesEnd).toBeTruthy();
    });
});
