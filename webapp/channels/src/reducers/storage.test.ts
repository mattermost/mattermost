// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericAction} from 'mattermost-redux/types/actions';

import storageReducer from 'reducers/storage';
import {StorageTypes} from 'utils/constants';

type ReducerState = ReturnType<typeof storageReducer>;

describe('Reducers.Storage', () => {
    const now = new Date();

    it('Storage.SET_ITEM', () => {
        const nextState = storageReducer(
            {
                storage: {},
            } as ReducerState,
            {
                type: StorageTypes.SET_ITEM,
                data: {
                    name: 'key',
                    prefix: 'user_id_',
                    value: 'value',
                    timestamp: now,
                },
            },
        );
        expect(nextState.storage).toEqual({
            user_id_key: {value: 'value', timestamp: now},
        });
    });

    it('Storage.SET_GLOBAL_ITEM', () => {
        const nextState = storageReducer(
            {
                storage: {},
            } as ReducerState,
            {
                type: StorageTypes.SET_GLOBAL_ITEM,
                data: {
                    name: 'key',
                    value: 'value',
                    timestamp: now,
                },
            },
        );
        expect(nextState.storage).toEqual({
            key: {value: 'value', timestamp: now},
        });
    });

    it('Storage.REMOVE_ITEM', () => {
        let nextState = storageReducer(
            {
                storage: {
                    user_id_key: 'value',
                },
            } as unknown as ReducerState,
            {
                type: StorageTypes.REMOVE_ITEM,
                data: {
                    name: 'key',
                    prefix: 'user_id_',
                },
            },
        );
        expect(nextState.storage).toEqual({});
        nextState = storageReducer(
            {
                storage: {},
            } as ReducerState,
            {
                type: StorageTypes.REMOVE_ITEM,
                data: {
                    name: 'key',
                    prefix: 'user_id_',
                },
            },
        );
        expect(nextState.storage).toEqual({});
    });

    it('Storage.REMOVE_GLOBAL_ITEM', () => {
        let nextState = storageReducer(
            {
                storage: {
                    key: 'value',
                },
            } as unknown as ReducerState,
            {
                type: StorageTypes.REMOVE_GLOBAL_ITEM,
                data: {
                    name: 'key',
                },
            },
        );
        expect(nextState.storage).toEqual({});
        nextState = storageReducer(
            {
                storage: {},
            } as ReducerState,
            {
                type: StorageTypes.REMOVE_GLOBAL_ITEM,
                data: {
                    name: 'key',
                },
            },
        );
        expect(nextState.storage).toEqual({});
    });

    describe('Storage.ACTION_ON_GLOBAL_ITEMS_WITH_PREFIX', () => {
        it('should call the provided action on the given objects', () => {
            const state = storageReducer({
                storage: {
                    prefix_key1: {value: 1, timestamp: now},
                    prefix_key2: {value: 2, timestamp: now},
                    not_prefix_key: {value: 3, timestamp: now},
                },
            } as unknown as ReducerState, {} as GenericAction);

            const nextState = storageReducer(state, {
                type: StorageTypes.ACTION_ON_GLOBAL_ITEMS_WITH_PREFIX,
                data: {
                    prefix: 'prefix',
                    action: (_key: string, value: number) => value + 5,
                },
            });

            expect(nextState).not.toBe(state);
            expect(nextState.storage.prefix_key1.value).toBe(6);
            expect(nextState.storage.prefix_key1.timestamp).not.toBe(now);
            expect(nextState.storage.prefix_key2.value).toBe(7);
            expect(nextState.storage.prefix_key2.timestamp).not.toBe(now);
            expect(nextState.storage.prefix_key3).toBe(state.storage.prefix_key3);
        });

        it('should return the original state if no results change', () => {
            const state = storageReducer({
                storage: {
                    prefix_key1: {value: 1, timestamp: now},
                    prefix_key2: {value: 2, timestamp: now},
                    not_prefix_key: {value: 3, timestamp: now},
                },
            } as unknown as ReducerState, {} as GenericAction);

            const nextState = storageReducer(state, {
                type: StorageTypes.ACTION_ON_GLOBAL_ITEMS_WITH_PREFIX,
                data: {
                    prefix: 'prefix',
                    action: (key: string, value: number) => value,
                },
            });

            expect(nextState).toBe(state);
        });
    });

    it('Storage.STORAGE_REHYDRATE', () => {
        let nextState = storageReducer(
            {
                storage: {},
            } as ReducerState,
            {
                type: StorageTypes.STORAGE_REHYDRATE,
                data: {test: '123'},
            },
        );
        expect(nextState.storage).toEqual({test: '123'});
        nextState = storageReducer(
            nextState,
            {
                type: StorageTypes.STORAGE_REHYDRATE,
                data: {test: '456'},
            },
        );
        expect(nextState.storage).toEqual({test: '456'});
        nextState = storageReducer(
            nextState,
            {
                type: StorageTypes.STORAGE_REHYDRATE,
                data: {test2: '789'},
            },
        );
        expect(nextState.storage).toEqual({test: '456', test2: '789'});
    });
});
