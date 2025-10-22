// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {
    togglePageOutline,
    setOutlineExpanded,
    clearOutlineCache,
} from 'actions/views/pages_hierarchy';
import {
    SET_OUTLINE_EXPANDED,
    CLEAR_OUTLINE_CACHE,
} from 'reducers/views/pages_hierarchy';

import mockStore from 'tests/test_store';

import type {GlobalState} from 'types/store';

jest.mock('utils/page_outline', () => ({
    extractHeadingsFromContent: jest.fn((content: string) => {
        if (content.includes('"type":"heading"')) {
            return [
                {id: 'heading-0', text: 'Test Heading 1', level: 1},
                {id: 'heading-1', text: 'Test Heading 2', level: 2},
            ];
        }
        if (content.includes('# ')) {
            return [
                {id: 'heading-0', text: 'Markdown Heading', level: 1},
            ];
        }
        return [];
    }),
}));

describe('pages_hierarchy actions', () => {
    const pageId = 'page123';
    const tiptapContent = '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Test Heading 1"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Test Heading 2"}]}]}';
    const markdownContent = '# Markdown Heading\nSome content';
    const emptyContent = '';

    describe('togglePageOutline', () => {
        it('should extract headings and expand outline when not expanded', async () => {
            const testStore = mockStore({
                views: {
                    pagesHierarchy: {
                        outlineExpandedNodes: {},
                        outlineCache: {},
                    },
                },
                entities: {
                    wikiPages: {
                        fullPages: {
                            [pageId]: {
                                id: pageId,
                                message: tiptapContent,
                            } as Post,
                        },
                    },
                },
            } as unknown as GlobalState);

            await testStore.dispatch(togglePageOutline(pageId));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: SET_OUTLINE_EXPANDED,
                data: {
                    pageId,
                    expanded: true,
                    headings: [
                        {id: 'heading-0', text: 'Test Heading 1', level: 1},
                        {id: 'heading-1', text: 'Test Heading 2', level: 2},
                    ],
                },
            });
        });

        it('should use provided content instead of fetching from state', async () => {
            const testStore = mockStore({
                views: {
                    pagesHierarchy: {
                        outlineExpandedNodes: {},
                        outlineCache: {},
                    },
                },
                entities: {
                    posts: {
                        posts: {},
                    },
                },
            } as unknown as GlobalState);

            await testStore.dispatch(togglePageOutline(pageId, markdownContent));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: SET_OUTLINE_EXPANDED,
                data: {
                    pageId,
                    expanded: true,
                    headings: [
                        {id: 'heading-0', text: 'Markdown Heading', level: 1},
                    ],
                },
            });
        });

        it('should collapse outline when already expanded', async () => {
            const testStore = mockStore({
                views: {
                    pagesHierarchy: {
                        outlineExpandedNodes: {
                            [pageId]: true,
                        },
                        outlineCache: {
                            [pageId]: [
                                {id: 'heading-0', text: 'Test Heading', level: 1},
                            ],
                        },
                    },
                },
                entities: {
                    posts: {
                        posts: {},
                    },
                },
            } as unknown as GlobalState);

            await testStore.dispatch(togglePageOutline(pageId));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: SET_OUTLINE_EXPANDED,
                data: {
                    pageId,
                    expanded: false,
                },
            });
        });

        it('should handle page with no content', async () => {
            const testStore = mockStore({
                views: {
                    pagesHierarchy: {
                        outlineExpandedNodes: {},
                        outlineCache: {},
                    },
                },
                entities: {
                    posts: {
                        posts: {
                            [pageId]: {
                                id: pageId,
                                message: emptyContent,
                            } as Post,
                        },
                    },
                },
            } as unknown as GlobalState);

            await testStore.dispatch(togglePageOutline(pageId));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: SET_OUTLINE_EXPANDED,
                data: {
                    pageId,
                    expanded: true,
                    headings: [],
                },
            });
        });

        it('should handle page not found in state', async () => {
            const testStore = mockStore({
                views: {
                    pagesHierarchy: {
                        outlineExpandedNodes: {},
                        outlineCache: {},
                    },
                },
                entities: {
                    posts: {
                        posts: {},
                    },
                },
            } as unknown as GlobalState);

            await testStore.dispatch(togglePageOutline('non-existent-page'));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: SET_OUTLINE_EXPANDED,
                data: {
                    pageId: 'non-existent-page',
                    expanded: true,
                    headings: [],
                },
            });
        });
    });

    describe('setOutlineExpanded', () => {
        it('should dispatch SET_OUTLINE_EXPANDED with provided data', () => {
            const testStore = mockStore({} as GlobalState);
            const headings = [
                {id: 'heading-0', text: 'Test', level: 1},
            ];

            testStore.dispatch(setOutlineExpanded(pageId, true, headings));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: SET_OUTLINE_EXPANDED,
                data: {
                    pageId,
                    expanded: true,
                    headings,
                },
            });
        });

        it('should dispatch without headings when collapsing', () => {
            const testStore = mockStore({} as GlobalState);

            testStore.dispatch(setOutlineExpanded(pageId, false));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: SET_OUTLINE_EXPANDED,
                data: {
                    pageId,
                    expanded: false,
                    headings: undefined,
                },
            });
        });
    });

    describe('clearOutlineCache', () => {
        it('should dispatch CLEAR_OUTLINE_CACHE', () => {
            const testStore = mockStore({} as GlobalState);

            testStore.dispatch(clearOutlineCache(pageId));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: CLEAR_OUTLINE_CACHE,
                data: {pageId},
            });
        });
    });
});
