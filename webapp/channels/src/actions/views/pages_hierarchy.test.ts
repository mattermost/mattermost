// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import {
    toggleNodeExpanded,
    expandAncestors,
    togglePagesPanel,
    openPagesPanel,
    closePagesPanel,
    setOutlineExpanded,
    clearOutlineCache,
    setLastViewedPage,
    togglePageOutline,
} from './pages_hierarchy';

// Mock the fetchPage action
jest.mock('actions/pages', () => ({
    fetchPage: jest.fn(() => () => Promise.resolve({data: {message: 'mock content'}})),
}));

// Mock the page outline utility
jest.mock('utils/page_outline', () => ({
    extractHeadingsFromContent: jest.fn((content) => {
        if (content) {
            return [{id: 'h1', text: 'Mock Heading', level: 1}];
        }
        return [];
    }),
}));

describe('pages_hierarchy actions', () => {
    describe('toggleNodeExpanded', () => {
        test('should return TOGGLE_PAGE_NODE_EXPANDED action', () => {
            const result = toggleNodeExpanded('wiki1', 'page1');

            expect(result).toEqual({
                type: ActionTypes.TOGGLE_PAGE_NODE_EXPANDED,
                data: {wikiId: 'wiki1', nodeId: 'page1'},
            });
        });
    });

    describe('expandAncestors', () => {
        test('should return EXPAND_PAGE_ANCESTORS action', () => {
            const ancestorIds = ['page1', 'page2', 'page3'];

            const result = expandAncestors('wiki1', ancestorIds);

            expect(result).toEqual({
                type: ActionTypes.EXPAND_PAGE_ANCESTORS,
                data: {wikiId: 'wiki1', ancestorIds},
            });
        });

        test('should handle empty ancestor array', () => {
            const result = expandAncestors('wiki1', []);

            expect(result).toEqual({
                type: ActionTypes.EXPAND_PAGE_ANCESTORS,
                data: {wikiId: 'wiki1', ancestorIds: []},
            });
        });
    });

    describe('togglePagesPanel', () => {
        test('should return TOGGLE_PAGES_PANEL action', () => {
            const result = togglePagesPanel();

            expect(result).toEqual({
                type: ActionTypes.TOGGLE_PAGES_PANEL,
            });
        });
    });

    describe('openPagesPanel', () => {
        test('should return OPEN_PAGES_PANEL action', () => {
            const result = openPagesPanel();

            expect(result).toEqual({
                type: ActionTypes.OPEN_PAGES_PANEL,
            });
        });
    });

    describe('closePagesPanel', () => {
        test('should return CLOSE_PAGES_PANEL action', () => {
            const result = closePagesPanel();

            expect(result).toEqual({
                type: ActionTypes.CLOSE_PAGES_PANEL,
            });
        });
    });

    describe('setOutlineExpanded', () => {
        test('should return SET_PAGE_OUTLINE_EXPANDED without headings', () => {
            const result = setOutlineExpanded('page1', true);

            expect(result).toEqual({
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {pageId: 'page1', expanded: true, headings: undefined},
            });
        });

        test('should return SET_PAGE_OUTLINE_EXPANDED with headings', () => {
            const headings = [{id: 'h1', text: 'Heading', level: 1}];

            const result = setOutlineExpanded('page1', true, headings as any);

            expect(result).toEqual({
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {pageId: 'page1', expanded: true, headings},
            });
        });
    });

    describe('clearOutlineCache', () => {
        test('should return CLEAR_PAGE_OUTLINE_CACHE action', () => {
            const result = clearOutlineCache('page1');

            expect(result).toEqual({
                type: ActionTypes.CLEAR_PAGE_OUTLINE_CACHE,
                data: {pageId: 'page1'},
            });
        });
    });

    describe('setLastViewedPage', () => {
        test('should return SET_LAST_VIEWED_PAGE action', () => {
            const result = setLastViewedPage('wiki1', 'page1');

            expect(result).toEqual({
                type: ActionTypes.SET_LAST_VIEWED_PAGE,
                data: {wikiId: 'wiki1', pageId: 'page1'},
            });
        });
    });

    describe('togglePageOutline', () => {
        test('should collapse outline when already expanded', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn((): any => ({
                views: {
                    pagesHierarchy: {
                        outlineExpandedNodes: {page1: true},
                    },
                },
                entities: {
                    posts: {posts: {}},
                },
            }));

            const result = await togglePageOutline('page1')(dispatch, getState, undefined);

            expect(dispatch).toHaveBeenCalledWith({
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {pageId: 'page1', expanded: false},
            });
            expect(result).toEqual({data: true});
        });

        test('should expand outline with provided content', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn((): any => ({
                views: {
                    pagesHierarchy: {
                        outlineExpandedNodes: {},
                    },
                },
                entities: {
                    posts: {posts: {}},
                },
            }));

            const result = await togglePageOutline('page1', '{"type":"doc"}')(dispatch, getState, undefined);

            expect(dispatch).toHaveBeenCalledWith({
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {
                    pageId: 'page1',
                    expanded: true,
                    headings: [{id: 'h1', text: 'Mock Heading', level: 1}],
                },
            });
            expect(result).toEqual({data: true});
        });

        test('should use content from state when not provided', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn((): any => ({
                views: {
                    pagesHierarchy: {
                        outlineExpandedNodes: {},
                    },
                },
                entities: {
                    posts: {
                        posts: {
                            page1: {id: 'page1', message: 'existing content'},
                        },
                    },
                },
            }));

            await togglePageOutline('page1')(dispatch, getState, undefined);

            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
            }));
        });
    });
});
