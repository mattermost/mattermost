// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';

import {makeInitialPagesState} from 'tests/helpers/pages_state';

import type {GlobalState} from 'types/store';

import {
    getPage,
    getPageAncestors,
    getPages,
    getChannelPages,
    getPagesLoading,
    getPagesError,
} from './pages';

describe('pages selectors', () => {
    const wikiId = 'wiki123';
    const pageId1 = 'page1';
    const pageId2 = 'page2';
    const pageId3 = 'page3';

    const mockPage1: Post = {
        id: pageId1,
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        user_id: 'user123',
        channel_id: wikiId,
        root_id: '',
        original_id: '',
        page_parent_id: '',
        message: 'Page 1 content',
        type: PostTypes.PAGE,
        props: {title: 'Root Page'},
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
    };

    const mockPage2: Post = {
        ...mockPage1,
        id: pageId2,
        page_parent_id: pageId1,
        props: {title: 'Child Page'},
        message: 'Page 2 content',
    };

    const mockPage3: Post = {
        ...mockPage1,
        id: pageId3,
        page_parent_id: pageId2,
        props: {title: 'Grandchild Page'},
        message: 'Page 3 content',
    };

    const initialState: Partial<GlobalState> = {
        entities: {
            pages: makeInitialPagesState({
                byId: {
                    [pageId1]: mockPage1,
                    [pageId2]: mockPage2,
                    [pageId3]: mockPage3,
                },
                byWiki: {
                    [wikiId]: [pageId1, pageId2, pageId3],
                },
            }),
            wikiPages: null,
        },
        requests: {
            wiki: {
                loading: {},
                error: {},
            },
        },
    } as any;

    describe('getPage', () => {
        test('should return page from entities.pages.byId', () => {
            const page = getPage(initialState as GlobalState, pageId1);

            expect(page).toEqual(mockPage1);
            expect(page?.id).toBe(pageId1);
            expect(page?.props?.title).toBe('Root Page');
        });

        test('should return undefined for non-existent page', () => {
            const page = getPage(initialState as GlobalState, 'non-existent');

            expect(page).toBeUndefined();
        });

        test('should read from single source of truth (entities.pages.byId)', () => {
            const page = getPage(initialState as GlobalState, pageId1);

            expect(page).toBe(initialState.entities!.pages.byId[pageId1]);
        });

        test('wikiPages slice should only hold the status field definition', () => {
            const state = initialState as GlobalState;

            // After the pages/wikiPages split, wikiPages stores the SelectPropertyField | null
            // directly; byId/byWiki/timestamps now live in entities.pages.
            expect(state.entities!.wikiPages).toBeNull();
        });
    });

    describe('getPageAncestors', () => {
        test('should return empty array for root page', () => {
            const ancestors = getPageAncestors(initialState as GlobalState, pageId1);

            expect(ancestors).toEqual([]);
        });

        test('should return single ancestor', () => {
            const ancestors = getPageAncestors(initialState as GlobalState, pageId2);

            expect(ancestors).toEqual([mockPage1]);
            expect(ancestors[0].id).toBe(pageId1);
        });

        test('should return full ancestor chain', () => {
            const ancestors = getPageAncestors(initialState as GlobalState, pageId3);

            expect(ancestors).toEqual([mockPage1, mockPage2]);
            expect(ancestors[0].id).toBe(pageId1);
            expect(ancestors[1].id).toBe(pageId2);
        });

        test('should stop at missing parent', () => {
            const stateWithMissingParent: Partial<GlobalState> = {
                entities: {
                    pages: makeInitialPagesState({
                        byId: {
                            [pageId3]: mockPage3,
                        },
                        byWiki: {[wikiId]: [pageId3]},
                    }),
                    wikiPages: null,
                },
            } as any;

            const ancestors = getPageAncestors(stateWithMissingParent as GlobalState, pageId3);

            expect(ancestors).toEqual([]);
        });

        test('should handle circular reference gracefully', () => {
            const circularPage1: Post = {...mockPage1, page_parent_id: pageId2};
            const circularPage2: Post = {...mockPage2, page_parent_id: pageId1};

            const stateWithCircular: Partial<GlobalState> = {
                entities: {
                    pages: makeInitialPagesState({
                        byId: {
                            [pageId1]: circularPage1,
                            [pageId2]: circularPage2,
                        },
                        byWiki: {[wikiId]: [pageId1, pageId2]},
                    }),
                    wikiPages: null,
                },
            } as any;

            const ancestors = getPageAncestors(stateWithCircular as GlobalState, pageId1);

            expect(ancestors.length).toBeLessThan(100);
        });
    });

    describe('getPages', () => {
        test('should return pages for wiki from entities.pages.byId', () => {
            const pages = getPages(initialState as GlobalState, wikiId);

            expect(pages).toHaveLength(3);
            expect(pages[0].id).toBe(pageId1);
            expect(pages[1].id).toBe(pageId2);
            expect(pages[2].id).toBe(pageId3);
        });

        test('should filter out non-PAGE types', () => {
            const stateWithNonPage: Partial<GlobalState> = {
                entities: {
                    pages: makeInitialPagesState({
                        byId: {
                            [pageId1]: mockPage1,
                            regularPost: {...mockPage1, id: 'regularPost', type: 'normal' as any},
                        },
                        byWiki: {[wikiId]: [pageId1, 'regularPost']},
                    }),
                    wikiPages: null,
                },
            } as any;

            const pages = getPages(stateWithNonPage as GlobalState, wikiId);

            expect(pages).toHaveLength(1);
            expect(pages[0].id).toBe(pageId1);
        });

        test('should return empty array for non-existent wiki', () => {
            const pages = getPages(initialState as GlobalState, 'non-existent-wiki');

            expect(pages).toEqual([]);
        });

        test('should filter out missing pages', () => {
            const stateWithMissing: Partial<GlobalState> = {
                entities: {
                    pages: makeInitialPagesState({
                        byId: {
                            [pageId1]: mockPage1,
                        },
                        byWiki: {[wikiId]: [pageId1, 'missing-page']},
                    }),
                    wikiPages: null,
                },
            } as any;

            const pages = getPages(stateWithMissing as GlobalState, wikiId);

            expect(pages).toHaveLength(1);
            expect(pages[0].id).toBe(pageId1);
        });

        test('should use memoization (createSelector)', () => {
            const pages1 = getPages(initialState as GlobalState, wikiId);
            const pages2 = getPages(initialState as GlobalState, wikiId);

            expect(pages1).toBe(pages2);
        });

        test('should read from single source of truth', () => {
            const pages = getPages(initialState as GlobalState, wikiId);

            pages.forEach((page) => {
                expect(page).toBe(initialState.entities!.pages.byId[page.id]);
            });
        });
    });

    describe('getChannelPages', () => {
        const channelId = 'channel123';
        const otherChannelId = 'channel456';

        const channelPage1: Post = {
            ...mockPage1,
            id: 'channelPage1',
            channel_id: channelId,
        };

        const channelPage2: Post = {
            ...mockPage1,
            id: 'channelPage2',
            channel_id: channelId,
        };

        const otherChannelPage: Post = {
            ...mockPage1,
            id: 'otherChannelPage',
            channel_id: otherChannelId,
        };

        const makeState = (byId: Record<string, Post>): Partial<GlobalState> => ({
            entities: {
                pages: makeInitialPagesState({byId}),
            } as any,
        });

        test('should return all pages matching the channelId', () => {
            const state = makeState({channelPage1, channelPage2, otherChannelPage});

            const pages = getChannelPages(state as GlobalState, channelId);

            expect(pages).toHaveLength(2);
            expect(pages.map((p) => p.id).sort()).toEqual(['channelPage1', 'channelPage2']);
        });

        test('should return empty array when no pages match channelId', () => {
            const state = makeState({otherChannelPage});

            const pages = getChannelPages(state as GlobalState, channelId);

            expect(pages).toEqual([]);
        });

        test('should filter out non-PAGE posts', () => {
            const regularPost: Post = {
                ...mockPage1,
                id: 'regularPost',
                channel_id: channelId,
                type: '' as any,
            };

            const state = makeState({channelPage1, regularPost});

            const pages = getChannelPages(state as GlobalState, channelId);

            expect(pages).toHaveLength(1);
            expect(pages[0].id).toBe('channelPage1');
        });

        test('should use memoization', () => {
            const state = makeState({channelPage1});

            const pages1 = getChannelPages(state as GlobalState, channelId);
            const pages2 = getChannelPages(state as GlobalState, channelId);

            expect(pages1).toBe(pages2);
        });
    });

    describe('getPagesLoading', () => {
        test('should return loading state for wiki', () => {
            const stateWithLoading: Partial<GlobalState> = {
                ...initialState,
                requests: {
                    ...initialState.requests,
                    wiki: {
                        ...initialState.requests!.wiki,
                        loading: {[wikiId]: true},
                    },
                },
            } as any;

            const loading = getPagesLoading(stateWithLoading as GlobalState, wikiId);

            expect(loading).toBe(true);
        });

        test('should return false if not loading', () => {
            const loading = getPagesLoading(initialState as GlobalState, wikiId);

            expect(loading).toBe(false);
        });
    });

    describe('getPagesError', () => {
        test('should return error for wiki', () => {
            const error = 'Failed to load pages';
            const stateWithError: Partial<GlobalState> = {
                ...initialState,
                requests: {
                    ...initialState.requests,
                    wiki: {
                        ...initialState.requests!.wiki,
                        error: {[wikiId]: error},
                    },
                },
            } as any;

            const errorResult = getPagesError(stateWithError as GlobalState, wikiId);

            expect(errorResult).toBe(error);
        });

        test('should return null if no error', () => {
            const error = getPagesError(initialState as GlobalState, wikiId);

            expect(error).toBeNull();
        });
    });

    describe('Single Source of Truth Validation', () => {
        test('all selectors should read from entities.pages.byId', () => {
            const state = initialState as GlobalState;

            const page = getPage(state, pageId1);
            expect(page).toBe(state.entities.pages.byId[pageId1]);

            const pages = getPages(state, wikiId);
            pages.forEach((p) => {
                expect(p).toBe(state.entities.pages.byId[p.id]);
            });

            const ancestors = getPageAncestors(state, pageId3);
            ancestors.forEach((p) => {
                expect(p).toBe(state.entities.pages.byId[p.id]);
            });
        });

        test('wikiPages slice should not carry page caches', () => {
            const state = initialState as GlobalState;

            // Legacy {pageSummaries, fullPages} caches were removed when pages got
            // their own slice; wikiPages is now just the status field definition.
            expect(state.entities.wikiPages).toBeNull();
        });
    });
});
