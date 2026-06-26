// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import configureStore from './index';

// Override the global mock in src/tests/redux-persist_mock.ts because we need to call the callback passed to persistStore
jest.mock('redux-persist', () => {
    const {combineReducers} = require('redux');
    const real = jest.requireActual('redux-persist');

    return {
        ...real,
        createTransform: () => {
            return {};
        },

        persistReducer: jest.fn().mockImplementation((config, reducers) => reducers),
        persistCombineReducers: (persistConfig: any, reducers: any) => combineReducers(reducers),
        persistStore: (store: unknown, persistorOptions: unknown, callback: () => void) => {
            setTimeout(callback);

            return {
                pause: () => {},
                purge: () => Promise.resolve(),
                resume: () => {},
            };
        },
    };
});

describe('configureStore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

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

    test('should mark store as hydrated', async () => {
        const store = configureStore();

        expect(store.getState().storage.initialized).toBe(false);

        await jest.runAllTimersAsync();

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

        await jest.runAllTimersAsync();

        const state = store.getState();
        expect(state.storage.storage.draft_channel_id.value.uploadsInProgress).toEqual([]);
        expect(state.storage.storage.comment_draft_root_id.value.uploadsInProgress).toEqual([]);
        expect(state.storage.storage.draft_channel_id.value.message).toBe('test message');
        expect(state.storage.storage.comment_draft_root_id.value.message).toBe('test comment');
    });
});
