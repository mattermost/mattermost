// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Selectors from 'selectors/rhs';

import {GlobalState} from 'types/store';

describe('Selectors.Rhs', () => {
    describe('should return the last time a post was selected', () => {
        [0, 1000000, 2000000].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    selectedPostFocussedAt: expected,
                }}} as GlobalState;

                expect(Selectors.getSelectedPostFocussedAt(state)).toEqual(expected);
            });
        });
    });

    describe('should return the open state of the sidebar', () => {
        [true, false].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    isSidebarOpen: expected,
                }}} as GlobalState;

                expect(Selectors.getIsRhsOpen(state)).toEqual(expected);
            });
        });
    });

    describe('should return the open state of the sidebar menu', () => {
        [true, false].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    isMenuOpen: expected,
                }}} as GlobalState;

                expect(Selectors.getIsRhsMenuOpen(state)).toEqual(expected);
            });
        });
    });

    describe('should return the highlighted reply\'s id', () => {
        test.each(['42', ''])('when id is %s', (expected) => {
            const state = {views: {rhs: {
                highlightedPostId: expected,
            }}} as GlobalState;

            expect(Selectors.getHighlightedPostId(state)).toEqual(expected);
        });
    });

    describe('should return the previousRhsState', () => {
        test.each([
            [[], null],
            [['channel-info'], 'channel-info'],
            [['channel-info', 'pinned'], 'pinned'],
        ])('%p gives %p', (previousArray, previous) => {
            const state = {
                views: {rhs: {
                    previousRhsStates: previousArray,
                }}} as GlobalState;
            expect(Selectors.getPreviousRhsState(state)).toEqual(previous);
        });
    });
});
