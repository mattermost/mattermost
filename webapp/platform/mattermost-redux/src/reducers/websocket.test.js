// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GeneralTypes} from 'mattermost-redux/action_types';

import reducer from './websocket';

describe('websocket', () => {
    describe('lastConnectAt', () => {
        test('should update lastConnectAt when first connecting', () => {
            let state = reducer(undefined, {});

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_SUCCESS,
                timestamp: 1000,
            });

            expect(state.connected).toBe(true);
            expect(state.lastConnectAt).toBe(1000);
        });

        test('should not update lastConnectAt when already connected', () => {
            let state = reducer(undefined, {});

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_SUCCESS,
                timestamp: 1000,
            });

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_SUCCESS,
                timestamp: 2000,
            });

            expect(state.connected).toBe(true);
            expect(state.lastConnectAt).toBe(1000);
        });

        test('should update when reconnecting', () => {
            let state = reducer(undefined, {});

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_SUCCESS,
                timestamp: 1000,
            });

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_FAILURE,
                timestamp: 2000,
            });

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_SUCCESS,
                timestamp: 3000,
            });

            expect(state.connected).toBe(true);
            expect(state.lastConnectAt).toBe(3000);
        });
    });

    describe('lastDisconnectAt', () => {
        test('should update lastDisconnectAt when disconnected', () => {
            let state = reducer(undefined, {});

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_SUCCESS,
                timestamp: 1000,
            });

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_FAILURE,
                timestamp: 2000,
            });

            expect(state.connected).toBe(false);
            expect(state.lastDisconnectAt).toBe(2000);
        });

        test('should not update lastDisconnectAt when failing to reconnect', () => {
            let state = reducer(undefined, {});

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_SUCCESS,
                timestamp: 1000,
            });

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_FAILURE,
                timestamp: 2000,
            });

            state = reducer(state, {
                type: GeneralTypes.WEBSOCKET_FAILURE,
                timestamp: 3000,
            });

            expect(state.connected).toBe(false);
            expect(state.lastDisconnectAt).toBe(2000);
        });
    });
});
