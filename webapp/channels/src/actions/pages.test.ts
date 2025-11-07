// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import * as Actions from 'actions/pages';

import mockStore from 'tests/test_store';

jest.mock('mattermost-redux/client');

describe('actions/pages - Page Status', () => {
    let testStore: ReturnType<typeof mockStore>;

    beforeEach(() => {
        testStore = mockStore({
            entities: {
                posts: {
                    posts: {},
                },
            },
        });
        jest.clearAllMocks();
    });

    describe('fetchPageStatusField', () => {
        test('should fetch page status field successfully', async () => {
            const mockField = {
                id: 'status_field_id',
                name: 'status',
                type: 'select',
                attrs: {
                    options: [
                        {id: 'rough_draft', name: 'Rough draft', color: 'light_grey'},
                        {id: 'in_progress', name: 'In progress', color: 'light_blue'},
                        {id: 'in_review', name: 'In review', color: 'dark_blue'},
                        {id: 'done', name: 'Done', color: 'green'},
                    ],
                },
            };

            (Client4.getPageStatusField as jest.Mock).mockResolvedValue(mockField);

            await testStore.dispatch(Actions.fetchPageStatusField());

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                data: mockField,
            });
        });

        test('should handle error when fetching page status field fails', async () => {
            const error = new Error('Failed to fetch status field');
            (Client4.getPageStatusField as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(Actions.fetchPageStatusField());

            expect(result.error).toBeTruthy();
            const actions = testStore.getActions();
            expect(actions).toHaveLength(0);
        });
    });

    describe('updatePageStatus', () => {
        test('should update page status successfully', async () => {
            const postId = 'test_post_id';
            const status = 'Done';
            const mockPost = {
                id: postId,
                props: {title: 'Test Page'},
            };

            testStore.getState().entities.posts.posts = {[postId]: mockPost as any};
            (Client4.updatePageStatus as jest.Mock).mockResolvedValue({});

            await testStore.dispatch(Actions.updatePageStatus(postId, status));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0].type).toBe('RECEIVED_POST');
            expect(actions[0].data.id).toBe(postId);
            expect(actions[0].data.props.page_status).toBe(status);
        });

        test('should handle error when updating page status fails', async () => {
            const postId = 'test_post_id';
            const status = 'Done';
            const error = new Error('Failed to update status');
            (Client4.updatePageStatus as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(Actions.updatePageStatus(postId, status));

            expect(result.error).toBeTruthy();
            const actions = testStore.getActions();
            expect(actions).toHaveLength(0);
        });

        test('should update with all valid status values', async () => {
            const postId = 'test_post_id';
            const validStatuses = ['Rough draft', 'In progress', 'In review', 'Done'];
            const mockPost = {
                id: postId,
                props: {title: 'Test Page'},
            };

            testStore.getState().entities.posts.posts = {[postId]: mockPost as any};
            (Client4.updatePageStatus as jest.Mock).mockResolvedValue({});

            const statusTests = validStatuses.map(async (status) => {
                testStore.clearActions();
                await testStore.dispatch(Actions.updatePageStatus(postId, status));

                const actions = testStore.getActions();
                expect(actions).toHaveLength(1);
                expect(actions[0].type).toBe('RECEIVED_POST');
                expect(actions[0].data.props.page_status).toBe(status);
            });

            await Promise.all(statusTests);
        });
    });
});
