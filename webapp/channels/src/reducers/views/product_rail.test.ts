// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {productRailPathsLoaded, productRailPathViewed, setProductRailSection} from 'actions/views/product_rail';

import productRailReducer from './product_rail';

const initial = productRailReducer(undefined, {type: 'INIT'});

describe('productRail reducer', () => {
    test('should remember the last path per item and team', () => {
        let state = productRailReducer(initial, productRailPathViewed('boards', 'team1', '/one/channels/roadmap', 'boards'));
        state = productRailReducer(state, productRailPathViewed('boards', 'team2', '/two/channels/bugs', 'boards'));
        state = productRailReducer(state, productRailPathViewed('threads', 'team1', '/one/threads/abc'));

        expect(state.lastPathByTeam).toEqual({
            boards: {team1: '/one/channels/roadmap', team2: '/two/channels/bugs'},
            threads: {team1: '/one/threads/abc'},
        });
    });

    test('should move to the section of a viewed channel or board, and only then', () => {
        let state = productRailReducer(initial, productRailPathViewed('boards', 'team1', '/one/channels/roadmap', 'boards'));
        expect(state.section).toBe('boards');

        state = productRailReducer(state, productRailPathViewed('threads', 'team1', '/one/threads'));
        expect(state.section).toBe('boards');

        state = productRailReducer(state, setProductRailSection('channels'));
        expect(state.section).toBe('channels');
    });

    test('should let paths viewed this session win over saved ones', () => {
        let state = productRailReducer(initial, productRailPathViewed('channels', 'team1', '/one/channels/new'));
        state = productRailReducer(state, productRailPathsLoaded({
            channels: {team1: '/one/channels/old', team2: '/two/channels/saved'},
            threads: {team1: '/one/threads/saved'},
        }));

        expect(state.lastPathByTeam).toEqual({
            channels: {team1: '/one/channels/new', team2: '/two/channels/saved'},
            threads: {team1: '/one/threads/saved'},
        });
    });

    test('should take a channel out of Channels once it turns out to be a board', () => {
        // Filed under Channels before the boards plugin had loaded its boards.
        let state = productRailReducer(initial, productRailPathViewed('channels', 'team1', '/one/channels/roadmap', 'channels'));
        state = productRailReducer(state, productRailPathViewed('boards', 'team1', '/one/channels/roadmap', 'boards'));

        expect(state.lastPathByTeam).toEqual({
            channels: {},
            boards: {team1: '/one/channels/roadmap'},
        });
    });

    test('should mark the saved paths as restored', () => {
        expect(initial.lastPathsLoaded).toBe(false);
        expect(productRailReducer(initial, productRailPathsLoaded({})).lastPathsLoaded).toBe(true);
    });
});
