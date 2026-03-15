// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import configureStore from './index';

describe('configureStore', () => {
    test('should match initial state after logout', () => {
        const store = configureStore();

        const initialState = store.getState();

        store.dispatch({type: UserTypes.LOGOUT_SUCCESS, data: {}});

        expect(store.getState()).toEqual({
            ...initialState,
            requests: {
                ...initialState.requests,
                users: {
                    ...initialState.requests.users,
                    logout: {
                        error: null,
                        status: 'success',
                    },
                },
            },
        });
    });
});

test('should mark store as hydrated', async () => {
    const store = configureStore();

    expect(store.getState().storage.initialized).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(store.getState().storage.initialized).toBe(true);
});

test('should clear uploadsInProgress from drafts on rehydration', async () => {
    const store = configureStore({
        storage: {
            storage: {
                draft_channel_id: {
                    value: {
                        message: 'test message',
                        uploadsInProgress: ['upload1', 'upload2'],
                    },
                },
                comment_draft_root_id: {
                    value: {
                        message: 'test comment',
                        uploadsInProgress: ['upload3'],
                    },
                },
            },
        },
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const state = store.getState();
    expect(state.storage.storage.draft_channel_id.value.uploadsInProgress).toEqual([]);
    expect(state.storage.storage.comment_draft_root_id.value.uploadsInProgress).toEqual([]);
    expect(state.storage.storage.draft_channel_id.value.message).toBe('test message');
    expect(state.storage.storage.comment_draft_root_id.value.message).toBe('test comment');
});
