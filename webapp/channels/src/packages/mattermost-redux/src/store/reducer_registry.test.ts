// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import reducerRegistry from 'mattermost-redux/store/reducer_registry';
import configureStore from '../../test/test_store';

describe('ReducerRegistry', () => {
    let store = configureStore();

    function testReducer() {
        return 'teststate';
    }

    beforeEach(() => {
        store = configureStore();
    });

    it('register reducer', () => {
        reducerRegistry.register('testReducer', testReducer);
        expect(store.getState().testReducer).toBe('teststate');
    });

    it('get reducers', () => {
        reducerRegistry.register('testReducer', testReducer);
        const reducers = reducerRegistry.getReducers();
        expect(reducers.testReducer).toBeTruthy();
    });
});

