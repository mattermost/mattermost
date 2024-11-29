// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'redux';
import {UserTypes} from 'mattermost-redux/action_types';
import {GlobalState} from '@mattermost/types/store';

import configureStore from './index';

describe('configureStore', () => {
    test('should match initial state after logout', () => {
        const store: Store<GlobalState> = configureStore();

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
