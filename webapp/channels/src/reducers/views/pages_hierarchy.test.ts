// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import pagesHierarchyReducer from './pages_hierarchy';

describe('reducers/views/pages_hierarchy', () => {
    const initialState = {
        expandedNodes: {},
        isPanelCollapsed: false,
        outlineExpandedNodes: {},
        outlineCache: {},
        lastViewedPage: {},
    };

    test('should return initial state', () => {
        const result = pagesHierarchyReducer(undefined, {type: 'UNKNOWN_ACTION'});

        expect(result).toEqual(initialState);
    });

    describe('ActionTypes.TOGGLE_PAGE_NODE_EXPANDED', () => {
        test('should expand a collapsed node', () => {
            const action = {
                type: ActionTypes.TOGGLE_PAGE_NODE_EXPANDED,
                data: {wikiId: 'wiki1', nodeId: 'page1'},
            };

            const result = pagesHierarchyReducer(initialState, action);

            expect(result.expandedNodes).toEqual({
                wiki1: {page1: true},
            });
        });

        test('should collapse an expanded node', () => {
            const state = {
                ...initialState,
                expandedNodes: {
                    wiki1: {page1: true},
                },
            };
            const action = {
                type: ActionTypes.TOGGLE_PAGE_NODE_EXPANDED,
                data: {wikiId: 'wiki1', nodeId: 'page1'},
            };

            const result = pagesHierarchyReducer(state, action);

            expect(result.expandedNodes.wiki1.page1).toBe(false);
        });

        test('should handle multiple wikis', () => {
            const state = {
                ...initialState,
                expandedNodes: {
                    wiki1: {page1: true},
                },
            };
            const action = {
                type: ActionTypes.TOGGLE_PAGE_NODE_EXPANDED,
                data: {wikiId: 'wiki2', nodeId: 'page2'},
            };

            const result = pagesHierarchyReducer(state, action);

            expect(result.expandedNodes).toEqual({
                wiki1: {page1: true},
                wiki2: {page2: true},
            });
        });
    });

    describe('ActionTypes.EXPAND_PAGE_ANCESTORS', () => {
        test('should expand all ancestors', () => {
            const action = {
                type: ActionTypes.EXPAND_PAGE_ANCESTORS,
                data: {wikiId: 'wiki1', ancestorIds: ['page1', 'page2', 'page3']},
            };

            const result = pagesHierarchyReducer(initialState, action);

            expect(result.expandedNodes).toEqual({
                wiki1: {
                    page1: true,
                    page2: true,
                    page3: true,
                },
            });
        });

        test('should preserve existing expanded nodes', () => {
            const state = {
                ...initialState,
                expandedNodes: {
                    wiki1: {existingPage: true},
                },
            };
            const action = {
                type: ActionTypes.EXPAND_PAGE_ANCESTORS,
                data: {wikiId: 'wiki1', ancestorIds: ['page1']},
            };

            const result = pagesHierarchyReducer(state, action);

            expect(result.expandedNodes.wiki1).toEqual({
                existingPage: true,
                page1: true,
            });
        });
    });

    describe('ActionTypes.TOGGLE_PAGES_PANEL', () => {
        test('should toggle panel from open to closed', () => {
            const action = {type: ActionTypes.TOGGLE_PAGES_PANEL};

            const result = pagesHierarchyReducer(initialState, action);

            expect(result.isPanelCollapsed).toBe(true);
        });

        test('should toggle panel from closed to open', () => {
            const state = {...initialState, isPanelCollapsed: true};
            const action = {type: ActionTypes.TOGGLE_PAGES_PANEL};

            const result = pagesHierarchyReducer(state, action);

            expect(result.isPanelCollapsed).toBe(false);
        });
    });

    describe('ActionTypes.OPEN_PAGES_PANEL', () => {
        test('should open panel', () => {
            const state = {...initialState, isPanelCollapsed: true};
            const action = {type: ActionTypes.OPEN_PAGES_PANEL};

            const result = pagesHierarchyReducer(state, action);

            expect(result.isPanelCollapsed).toBe(false);
        });
    });

    describe('ActionTypes.CLOSE_PAGES_PANEL', () => {
        test('should close panel', () => {
            const action = {type: ActionTypes.CLOSE_PAGES_PANEL};

            const result = pagesHierarchyReducer(initialState, action);

            expect(result.isPanelCollapsed).toBe(true);
        });
    });

    describe('ActionTypes.SET_PAGE_OUTLINE_EXPANDED', () => {
        test('should set outline expanded state', () => {
            const action = {
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {pageId: 'page1', expanded: true},
            };

            const result = pagesHierarchyReducer(initialState, action);

            expect(result.outlineExpandedNodes).toEqual({page1: true});
        });

        test('should set outline expanded with headings cache', () => {
            const headings = [{id: 'h1', text: 'Heading 1', level: 1}];
            const action = {
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {pageId: 'page1', expanded: true, headings},
            };

            const result = pagesHierarchyReducer(initialState, action);

            expect(result.outlineExpandedNodes).toEqual({page1: true});
            expect(result.outlineCache).toEqual({page1: headings});
        });

        test('should not update cache when headings not provided', () => {
            const state = {
                ...initialState,
                outlineCache: {existingPage: [{id: 'h', text: 'H', level: 1}]},
            };
            const action = {
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {pageId: 'page1', expanded: true},
            };

            const result = pagesHierarchyReducer(state, action);

            expect(result.outlineCache).toEqual(state.outlineCache);
        });
    });

    describe('ActionTypes.TOGGLE_PAGE_OUTLINE_EXPANDED', () => {
        test('should toggle outline from collapsed to expanded', () => {
            const action = {
                type: ActionTypes.TOGGLE_PAGE_OUTLINE_EXPANDED,
                data: {pageId: 'page1'},
            };

            const result = pagesHierarchyReducer(initialState, action);

            expect(result.outlineExpandedNodes.page1).toBe(true);
        });

        test('should toggle outline from expanded to collapsed', () => {
            const state = {
                ...initialState,
                outlineExpandedNodes: {page1: true},
            };
            const action = {
                type: ActionTypes.TOGGLE_PAGE_OUTLINE_EXPANDED,
                data: {pageId: 'page1'},
            };

            const result = pagesHierarchyReducer(state, action);

            expect(result.outlineExpandedNodes.page1).toBe(false);
        });
    });

    describe('ActionTypes.CLEAR_PAGE_OUTLINE_CACHE', () => {
        test('should clear outline cache for a page', () => {
            const state = {
                ...initialState,
                outlineCache: {
                    page1: [{id: 'h1', text: 'Heading', level: 1}],
                    page2: [{id: 'h2', text: 'Other', level: 1}],
                },
                outlineExpandedNodes: {
                    page1: true,
                    page2: true,
                },
            };
            const action = {
                type: ActionTypes.CLEAR_PAGE_OUTLINE_CACHE,
                data: {pageId: 'page1'},
            };

            const result = pagesHierarchyReducer(state, action);

            expect(result.outlineCache).toEqual({
                page2: [{id: 'h2', text: 'Other', level: 1}],
            });
            expect(result.outlineExpandedNodes).toEqual({page2: true});
        });
    });

    describe('ActionTypes.SET_LAST_VIEWED_PAGE', () => {
        test('should set last viewed page for a wiki', () => {
            const action = {
                type: ActionTypes.SET_LAST_VIEWED_PAGE,
                data: {wikiId: 'wiki1', pageId: 'page1'},
            };

            const result = pagesHierarchyReducer(initialState, action);

            expect(result.lastViewedPage).toEqual({wiki1: 'page1'});
        });

        test('should update last viewed page for existing wiki', () => {
            const state = {
                ...initialState,
                lastViewedPage: {wiki1: 'oldPage'},
            };
            const action = {
                type: ActionTypes.SET_LAST_VIEWED_PAGE,
                data: {wikiId: 'wiki1', pageId: 'newPage'},
            };

            const result = pagesHierarchyReducer(state, action);

            expect(result.lastViewedPage.wiki1).toBe('newPage');
        });
    });

    describe('UserTypes.LOGOUT_SUCCESS', () => {
        test('should reset to initial state on logout', () => {
            const state = {
                expandedNodes: {wiki1: {page1: true}},
                isPanelCollapsed: true,
                outlineExpandedNodes: {page1: true},
                outlineCache: {page1: [{id: 'h1', text: 'H', level: 1}]},
                lastViewedPage: {wiki1: 'page1'},
            };

            const action = {type: UserTypes.LOGOUT_SUCCESS};

            const result = pagesHierarchyReducer(state, action);

            expect(result).toEqual(initialState);
        });
    });

    test('should not modify state for unknown action', () => {
        const state = {
            ...initialState,
            expandedNodes: {wiki1: {page1: true}},
        };

        const result = pagesHierarchyReducer(state, {type: 'UNKNOWN_ACTION'});

        expect(result).toBe(state);
    });
});
