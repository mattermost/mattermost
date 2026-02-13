// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiTypes, UserTypes} from 'mattermost-redux/action_types';

import wikiRequestsReducer from './wiki';

describe('wiki requests reducer', () => {
    const wikiId = 'wiki123';

    describe('loading', () => {
        test('should set loading to true on GET_PAGES_REQUEST', () => {
            const action = {
                type: WikiTypes.GET_PAGES_REQUEST,
                data: {wikiId},
            };

            const nextState = wikiRequestsReducer(undefined, action);

            expect(nextState.loading[wikiId]).toBe(true);
        });

        test('should set loading to false on GET_PAGES_SUCCESS', () => {
            const initialState = {
                loading: {[wikiId]: true},
                error: {},
            };
            const action = {
                type: WikiTypes.GET_PAGES_SUCCESS,
                data: {wikiId, pages: []},
            };

            const nextState = wikiRequestsReducer(initialState, action);

            expect(nextState.loading[wikiId]).toBe(false);
        });

        test('should set loading to false on GET_PAGES_FAILURE', () => {
            const initialState = {
                loading: {[wikiId]: true},
                error: {},
            };
            const action = {
                type: WikiTypes.GET_PAGES_FAILURE,
                data: {wikiId, error: 'Failed to load pages'},
            };

            const nextState = wikiRequestsReducer(initialState, action);

            expect(nextState.loading[wikiId]).toBe(false);
        });

        test('should remove wiki loading state on DELETED_WIKI', () => {
            const initialState = {
                loading: {[wikiId]: true, wiki456: false},
                error: {},
            };
            const action = {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId},
            };

            const nextState = wikiRequestsReducer(initialState, action);

            expect(nextState.loading[wikiId]).toBeUndefined();
            expect(nextState.loading.wiki456).toBe(false);
        });

        test('should reset loading on LOGOUT_SUCCESS', () => {
            const initialState = {
                loading: {[wikiId]: true, wiki456: false},
                error: {},
            };
            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };

            const nextState = wikiRequestsReducer(initialState, action);

            expect(nextState.loading).toEqual({});
        });
    });

    describe('error', () => {
        test('should clear error on GET_PAGES_REQUEST', () => {
            const initialState = {
                loading: {},
                error: {[wikiId]: 'Previous error'},
            };
            const action = {
                type: WikiTypes.GET_PAGES_REQUEST,
                data: {wikiId},
            };

            const nextState = wikiRequestsReducer(initialState, action);

            expect(nextState.error[wikiId]).toBeNull();
        });

        test('should set error on GET_PAGES_FAILURE', () => {
            const errorMsg = 'Failed to load pages';
            const action = {
                type: WikiTypes.GET_PAGES_FAILURE,
                data: {wikiId, error: errorMsg},
            };

            const nextState = wikiRequestsReducer(undefined, action);

            expect(nextState.error[wikiId]).toBe(errorMsg);
        });

        test('should remove wiki error state on DELETED_WIKI', () => {
            const initialState = {
                loading: {},
                error: {[wikiId]: 'Some error', wiki456: null},
            };
            const action = {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId},
            };

            const nextState = wikiRequestsReducer(initialState, action);

            expect(nextState.error[wikiId]).toBeUndefined();
            expect(nextState.error.wiki456).toBeNull();
        });

        test('should reset error on LOGOUT_SUCCESS', () => {
            const initialState = {
                loading: {},
                error: {[wikiId]: 'Some error', wiki456: null},
            };
            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };

            const nextState = wikiRequestsReducer(initialState, action);

            expect(nextState.error).toEqual({});
        });
    });
});
