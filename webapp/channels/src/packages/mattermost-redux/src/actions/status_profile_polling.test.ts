// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {PostMetadata} from '@mattermost/types/posts';

import * as Actions from 'mattermost-redux/actions/status_profile_polling';
import {Client4} from 'mattermost-redux/client';

import {waitFor} from 'tests/react_testing_utils';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.StatusProfilePolling', () => {
    let store = configureStore();

    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore({
            entities: {
                general: {
                    config: {
                        EnableUserStatuses: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                    },
                },
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {
                            id: 'current_user_id',
                            username: 'current_user',
                        },
                    },
                },
            },
        });
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('batchFetchStatusesProfilesGroupsFromPosts with empty posts', async () => {
        const {data} = await store.dispatch(Actions.batchFetchStatusesProfilesGroupsFromPosts([]));
        expect(data).toBe(false);
    });

    it('batchFetchStatusesProfilesGroupsFromPosts with posts', async () => {
        const post1 = TestHelper.getPostMock({
            id: 'post1',
            user_id: 'user1',
            message: 'test',
        });
        const post2 = TestHelper.getPostMock({
            id: 'post2',
            user_id: 'user2',
            message: '@user3 test',
        });
        const posts = [post1, post2];

        const usernameMock = nock(Client4.getBaseRoute()).
            post('/users/usernames').
            reply(200, [{id: 'user3', username: 'user3'}]);

        const {data} = await store.dispatch(Actions.batchFetchStatusesProfilesGroupsFromPosts(posts));
        expect(data).toBe(true);
        await waitFor(() => expect(usernameMock.isDone()).toBe(true));
    });

    it('batchFetchStatusesProfilesGroupsFromPosts with post metadata', async () => {
        const post = TestHelper.getPostMock({
            id: 'post1',
            user_id: 'user1',
            message: 'test',
            metadata: {
                embeds: [{
                    type: 'opengraph',
                    url: 'https://example.com/image.png',
                }],
            } as PostMetadata,
        });
        const posts = [post];

        const {data} = await store.dispatch(Actions.batchFetchStatusesProfilesGroupsFromPosts(posts));
        expect(data).toBe(true);
    });

    it('getUsersFromMentionedUsernamesAndGroups', async () => {
        const usernamesAndGroups = ['user1', 'group1'];

        const usernameMock = nock(Client4.getBaseRoute()).
            post('/users/usernames').
            reply(200, [{id: 'user1', username: 'user1'}]);

        const groupMock = nock(Client4.getBaseRoute()).
            post('/groups/names', ['group1']).
            reply(200, [{id: 'group1', name: 'group1'}]);

        const {data} = await store.dispatch(Actions.getUsersFromMentionedUsernamesAndGroups(usernamesAndGroups, true));
        await waitFor(() => expect(usernameMock.isDone()).toBe(true));
        await waitFor(() => expect(groupMock.isDone()).toBe(true));
        expect(data).toEqual(['group1']);
    });

    it('getUsersFromMentionedUsernamesAndGroups without license', async () => {
        const usernamesAndGroups = ['user1', 'group1'];

        const usernameMock = nock(Client4.getBaseRoute()).
            post('/users/usernames').
            reply(200, [{id: 'user1', username: 'user1'}]);

        const groupMock = nock(Client4.getBaseRoute()).
            post('/groups/names', ['group1']).
            reply(200, [{id: 'group1', name: 'group1'}]);

        const {data} = await store.dispatch(Actions.getUsersFromMentionedUsernamesAndGroups(usernamesAndGroups, false));
        await waitFor(() => expect(usernameMock.isDone()).toBe(true));
        await waitFor(() => expect(groupMock.isDone()).toBe(false));
        expect(data).toEqual(['group1']);
    });
});
