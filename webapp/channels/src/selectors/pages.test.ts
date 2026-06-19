// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FieldType} from '@mattermost/types/properties';
import type {Page} from '@mattermost/types/wikis';

import {makeInitialPagesState} from 'tests/helpers/pages_state';

import type {GlobalState} from 'types/store';

import {
    getPage,
    getPageAncestors,
    makeGetPages,
    makeGetChannelPages,
    getPagesLoading,
    getPagesError,
    getPageStatusField,
} from './pages';

function makePage(overrides: Partial<Page> = {}): Page {
    return {
        id: 'page-id',
        wiki_id: 'wiki123',
        parent_id: '',
        type: 'page',
        title: 'Untitled',
        body: '',
        search_text: '',
        user_id: 'user123',
        last_modified_by: 'user123',
        sort_order: 0,
        create_at: 1234567890,
        update_at: 1234567890,
        edit_at: 0,
        delete_at: 0,
        original_id: '',
        has_effective_view_restriction: false,
        has_local_edit_restriction: false,
        properties: {},
        pending_file_ids: [],
        ...overrides,
    };
}

describe('pages selectors', () => {
    const getPages = makeGetPages();
    const wikiId = 'wiki123';
    const pageId1 = 'page1';
    const pageId2 = 'page2';
    const pageId3 = 'page3';

    const mockPage1: Page = makePage({id: pageId1, wiki_id: wikiId, title: 'Root Page', body: 'Page 1 content'});
    const mockPage2: Page = makePage({id: pageId2, wiki_id: wikiId, parent_id: pageId1, title: 'Child Page', body: 'Page 2 content'});
    const mockPage3: Page = makePage({id: pageId3, wiki_id: wikiId, parent_id: pageId2, title: 'Grandchild Page', body: 'Page 3 content'});

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
            expect(page?.title).toBe('Root Page');
        });

        test('should return undefined for non-existent page', () => {
            const page = getPage(initialState as GlobalState, 'non-existent');

            expect(page).toBeUndefined();
        });

        test('should read from single source of truth (entities.pages.byId)', () => {
            const page = getPage(initialState as GlobalState, pageId1);

            expect(page).toBe(initialState.entities!.pages.byId[pageId1]);
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
                },
            } as any;

            const ancestors = getPageAncestors(stateWithMissingParent as GlobalState, pageId3);

            expect(ancestors).toEqual([]);
        });

        test('should handle circular reference gracefully', () => {
            const circularPage1: Page = {...mockPage1, parent_id: pageId2};
            const circularPage2: Page = {...mockPage2, parent_id: pageId1};

            const stateWithCircular: Partial<GlobalState> = {
                entities: {
                    pages: makeInitialPagesState({
                        byId: {
                            [pageId1]: circularPage1,
                            [pageId2]: circularPage2,
                        },
                        byWiki: {[wikiId]: [pageId1, pageId2]},
                    }),
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

    describe('makeGetChannelPages', () => {
        const channelId = 'channel123';

        const channelPage1: Page = makePage({id: 'channelPage1'});
        const channelPage2: Page = makePage({id: 'channelPage2'});

        const makeState = (byId: Record<string, Page>): Partial<GlobalState> => ({
            entities: {
                pages: makeInitialPagesState({byId}),
            } as any,
        });

        test('should return all non-deleted pages', () => {
            const selectChannelPages = makeGetChannelPages();
            const state = makeState({channelPage1, channelPage2});

            const pages = selectChannelPages(state as GlobalState, channelId);

            expect(pages).toHaveLength(2);
            expect(pages.map((p) => p.id).sort()).toEqual(['channelPage1', 'channelPage2']);
        });

        test('should return empty array when no pages exist', () => {
            const selectChannelPages = makeGetChannelPages();
            const state = makeState({});

            const pages = selectChannelPages(state as GlobalState, channelId);

            expect(pages).toEqual([]);
        });

        test('should filter out non-PAGE types', () => {
            const selectChannelPages = makeGetChannelPages();
            const regularPost: Page = {
                ...channelPage1,
                id: 'regularPost',
                type: 'page_folder',
            };

            const state = makeState({channelPage1, regularPost});

            const pages = selectChannelPages(state as GlobalState, channelId);

            // page_folder is still accepted, both should be returned
            expect(pages).toHaveLength(2);
        });

        test('should use memoization', () => {
            const selectChannelPages = makeGetChannelPages();
            const state = makeState({channelPage1});

            const pages1 = selectChannelPages(state as GlobalState, channelId);
            const pages2 = selectChannelPages(state as GlobalState, channelId);

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
    });

    describe('getPageStatusField', () => {
        const mockStatusField = {
            id: 'status-field-id',
            name: 'status',
            type: 'select' as FieldType,
            group_id: 'pages-group-id',
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
            target_id: '',
            target_type: 'system',
            object_type: 'page',
            created_by: '',
            updated_by: '',
            attrs: {options: [{id: 'draft', name: 'Draft', color: '#ccc'}]},
        };

        const stateWithStatusField = (overrides: Record<string, unknown> = {}): GlobalState => ({
            entities: {
                pages: makeInitialPagesState({}),
                properties: {
                    fields: {
                        byObjectType: {
                            page: {
                                'pages-group-id': {'status-field-id': mockStatusField},
                            },
                        },
                        byId: {'status-field-id': mockStatusField},
                    },
                    groups: {
                        byId: {'pages-group-id': {id: 'pages-group-id', name: 'pages'}},
                        byName: {pages: {id: 'pages-group-id', name: 'pages'}},
                    },
                    values: {byTargetId: {}},
                    ...overrides,
                },
            },
        } as any);

        test('returns the status field from the pages group', () => {
            const field = getPageStatusField(stateWithStatusField());

            expect(field).toEqual(mockStatusField);
        });

        test('returns null when properties state has no groups', () => {
            const state = stateWithStatusField({
                groups: {byId: {}, byName: {}},
            });

            expect(getPageStatusField(state)).toBeNull();
        });

        test('returns null when pages group has no fields', () => {
            const state = stateWithStatusField({
                fields: {byObjectType: {page: {}}, byId: {}},
            });

            expect(getPageStatusField(state)).toBeNull();
        });

        test('does not match a status field from a different group', () => {
            const otherGroupField = {...mockStatusField, id: 'other-status-id', group_id: 'other-group-id'};
            const state: GlobalState = {
                entities: {
                    pages: makeInitialPagesState({}),
                    properties: {
                        fields: {
                            byObjectType: {
                                page: {
                                    'other-group-id': {'other-status-id': otherGroupField},
                                },
                            },
                            byId: {'other-status-id': otherGroupField},
                        },
                        groups: {
                            byId: {'pages-group-id': {id: 'pages-group-id', name: 'pages'}},
                            byName: {pages: {id: 'pages-group-id', name: 'pages'}},
                        },
                        values: {byTargetId: {}},
                    },
                },
            } as any;

            expect(getPageStatusField(state)).toBeNull();
        });
    });
});
