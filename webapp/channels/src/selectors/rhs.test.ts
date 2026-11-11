// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Selectors from 'selectors/rhs';

import type {GlobalState} from 'types/store';

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

    describe('should return the search team', () => {
        test.each([
            [undefined, 'currentTeamId'],
            [null, 'currentTeamId'],
            ['', ''],
            ['searchTeamId', 'searchTeamId'],
        ])('%p gives %p', (searchTeam, expected) => {
            const state = {
                entities: {teams: {currentTeamId: 'currentTeamId'}},
                views: {rhs: {
                    searchTeam,
                }} as any,
            } as GlobalState;

            expect(Selectors.getSearchTeam(state)).toEqual(expected);
        });
    });

    describe('should start a new search on the current team rather than the team mentions are filtered to', () => {
        test.each([
            ['mention', 'mentionTeamId', 'currentTeamId'],
            ['search', 'searchTeamId', 'searchTeamId'],
            ['search', null, 'currentTeamId'],
        ])('in the %p view with %p stored gives %p', (rhsState, searchTeam, expected) => {
            const state = {
                entities: {teams: {currentTeamId: 'currentTeamId'}},
                views: {rhs: {
                    rhsState,
                    searchTeam,
                }} as any,
            } as GlobalState;

            expect(Selectors.getRegularSearchTeam(state)).toEqual(expected);
        });
    });

    describe('should read the results of the search that was actually run', () => {
        function stateFor(rhsState: string, searchTeam: string | null) {
            return {
                entities: {
                    teams: {currentTeamId: 'currentTeamId'},
                    search: {
                        current: {
                            ALL_TEAMS: {isEnd: true},
                            searchTeamId: {isEnd: false},
                            currentTeamId: {isEnd: 'current team'},
                        },
                    },
                },
                views: {rhs: {rhsState, searchTeam}} as any,
            } as unknown as GlobalState;
        }

        test('an unscoped mention search reads the all teams results', () => {
            expect(Selectors.getCurrentSearchForSearchTeam(stateFor('mention', null))).toEqual({isEnd: true});
        });

        test('a mention search scoped to a team reads that team\'s results', () => {
            // Paging a filtered panel has to ask the same search for its next page, so the two can't
            // both be read out of the all teams bucket.
            expect(Selectors.getCurrentSearchForSearchTeam(stateFor('mention', 'searchTeamId'))).toEqual({isEnd: false});
        });

        test('an ordinary search reads its own team, falling back to the team being looked at', () => {
            expect(Selectors.getCurrentSearchForSearchTeam(stateFor('search', 'searchTeamId'))).toEqual({isEnd: false});
            expect(Selectors.getCurrentSearchForSearchTeam(stateFor('search', null))).toEqual({isEnd: 'current team'});
        });
    });
});
