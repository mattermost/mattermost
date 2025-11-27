// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {vi} from 'vitest';

vi.mock('redux-persist', async () => {
    const {combineReducers} = await import('redux');
    const real = await vi.importActual('redux-persist');

    return {
        ...real,
        createTransform: () => {
            return {};
        },

        persistReducer: vi.fn().mockImplementation((config, reducers) => reducers),
        persistCombineReducers: (persistConfig: any, reducers: any) => combineReducers(reducers),
        persistStore: () => {
            return {
                pause: () => {},
                purge: () => Promise.resolve(),
                resume: () => {},
            };
        },
    };
});

export default {};
