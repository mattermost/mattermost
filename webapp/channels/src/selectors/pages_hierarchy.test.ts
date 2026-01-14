// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import {
    getExpandedNodes,
    isNodeExpanded,
    getIsPanesPanelCollapsed,
    getLastViewedPage,
    getPageAncestorIds,
} from './pages_hierarchy';

// Mock the tree_builder utilities
jest.mock('components/pages_hierarchy_panel/utils/tree_builder', () => ({
    buildTree: jest.fn((pages) => pages),
    getAncestorIds: jest.fn((pages, pageId) => {
        // Simple mock implementation that finds parent chain
        const pageMap = new Map(pages.map((p: any) => [p.id, p]));
        const ancestors: string[] = [];
        let current: any = pageMap.get(pageId);
        while (current?.page_parent_id) {
            ancestors.push(current.page_parent_id);
            current = pageMap.get(current.page_parent_id);
        }
        return ancestors;
    }),
}));

// Mock the pages selector
jest.mock('selectors/pages', () => ({
    getPages: jest.fn((state, wikiId) => state.mockPages?.[wikiId] || []),
}));

describe('pages_hierarchy selectors', () => {
    const baseState = {
        views: {
            pagesHierarchy: {
                expandedNodes: {
                    wiki1: {
                        page1: true,
                        page2: false,
                        page3: true,
                    },
                    wiki2: {
                        page4: true,
                    },
                },
                isPanelCollapsed: false,
                lastViewedPage: {
                    wiki1: 'page1',
                    wiki2: 'page5',
                },
                outlineExpandedNodes: {},
                outlineCache: {},
            },
        },
    } as unknown as GlobalState;

    describe('getExpandedNodes', () => {
        test('should return expanded nodes for a wiki', () => {
            const result = getExpandedNodes(baseState, 'wiki1');

            expect(result).toEqual({
                page1: true,
                page2: false,
                page3: true,
            });
        });

        test('should return empty object for unknown wiki', () => {
            const result = getExpandedNodes(baseState, 'unknownWiki');

            expect(result).toEqual({});
        });

        test('should return empty object when expandedNodes is empty', () => {
            const state = {
                views: {
                    pagesHierarchy: {
                        ...baseState.views.pagesHierarchy,
                        expandedNodes: {},
                    },
                },
            } as unknown as GlobalState;

            const result = getExpandedNodes(state, 'wiki1');
            expect(result).toEqual({});
        });
    });

    describe('isNodeExpanded', () => {
        test('should return true when node is expanded', () => {
            expect(isNodeExpanded(baseState, 'wiki1', 'page1')).toBe(true);
        });

        test('should return false when node is explicitly collapsed', () => {
            expect(isNodeExpanded(baseState, 'wiki1', 'page2')).toBe(false);
        });

        test('should return false when node is not in the map', () => {
            expect(isNodeExpanded(baseState, 'wiki1', 'unknownPage')).toBe(false);
        });

        test('should return false for unknown wiki', () => {
            expect(isNodeExpanded(baseState, 'unknownWiki', 'page1')).toBe(false);
        });
    });

    describe('getIsPanesPanelCollapsed', () => {
        test('should return false when panel is not collapsed', () => {
            expect(getIsPanesPanelCollapsed(baseState)).toBe(false);
        });

        test('should return true when panel is collapsed', () => {
            const state = {
                views: {
                    pagesHierarchy: {
                        ...baseState.views.pagesHierarchy,
                        isPanelCollapsed: true,
                    },
                },
            } as unknown as GlobalState;

            expect(getIsPanesPanelCollapsed(state)).toBe(true);
        });
    });

    describe('getLastViewedPage', () => {
        test('should return last viewed page for a wiki', () => {
            expect(getLastViewedPage(baseState, 'wiki1')).toBe('page1');
        });

        test('should return null for wiki with no last viewed page', () => {
            expect(getLastViewedPage(baseState, 'unknownWiki')).toBe(null);
        });

        test('should return different pages for different wikis', () => {
            expect(getLastViewedPage(baseState, 'wiki1')).toBe('page1');
            expect(getLastViewedPage(baseState, 'wiki2')).toBe('page5');
        });
    });

    describe('getPageAncestorIds', () => {
        test('should return ancestor IDs for a page', () => {
            const mockPages = [
                {id: 'page1', page_parent_id: ''},
                {id: 'page2', page_parent_id: 'page1'},
                {id: 'page3', page_parent_id: 'page2'},
            ];

            const state = {
                ...baseState,
                mockPages: {wiki1: mockPages},
            } as unknown as GlobalState;

            const result = getPageAncestorIds(state, 'wiki1', 'page3');

            expect(result).toEqual(['page2', 'page1']);
        });

        test('should return empty array for root page', () => {
            const mockPages = [
                {id: 'page1', page_parent_id: ''},
            ];

            const state = {
                ...baseState,
                mockPages: {wiki1: mockPages},
            } as unknown as GlobalState;

            const result = getPageAncestorIds(state, 'wiki1', 'page1');

            expect(result).toEqual([]);
        });
    });
});
