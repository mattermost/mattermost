// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import searchReducer from 'reducers/views/search';

import {SearchTypes} from 'utils/constants';

describe('Reducers.Search', () => {
    const initialState = {
        modalSearch: '',
        popoverSearch: '',
        channelMembersRhsSearch: '',
        modalFilters: {},
        userGridSearch: {},
        teamListSearch: '',
        channelListSearch: {},
    };

    test('Initial state', () => {
        const nextState = searchReducer(
            {
                modalSearch: '',
            },
            {} as AnyAction,
        );

        expect(nextState).toEqual(initialState);
    });

    test(`should trim the search term for ${SearchTypes.SET_MODAL_SEARCH}`, () => {
        const nextState = searchReducer(
            {
                modalSearch: '',
            },
            {
                type: SearchTypes.SET_MODAL_SEARCH,
                data: ' something ',
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            modalSearch: 'something',
        });
    });

    test('should set user grid search', () => {
        const filters = {team_roles: ['team_admin']};
        const nextState = searchReducer(
            {
                userGridSearch: {filters},
            },
            {
                type: SearchTypes.SET_USER_GRID_SEARCH,
                data: 'something',
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            userGridSearch: {term: 'something', filters},
        });
    });

    test('should set user grid filters', () => {
        const nextState = searchReducer(
            {
                userGridSearch: {term: 'something', filters: {team_roles: ['team_admin']}},
            },
            {
                type: SearchTypes.SET_USER_GRID_FILTERS,
                data: {team_id: '1', channel_roles: ['channel_admin']},
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            userGridSearch: {term: 'something', filters: {team_id: '1', channel_roles: ['channel_admin']}},
        });
    });

    test('should set and trim channel member rhs search', () => {
        const nextState = searchReducer(
            {
                channelMembersRhsSearch: '',
            },
            {
                type: SearchTypes.SET_CHANNEL_MEMBERS_RHS_SEARCH,
                data: 'data',
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            channelMembersRhsSearch: 'data',
        });
    });
});
