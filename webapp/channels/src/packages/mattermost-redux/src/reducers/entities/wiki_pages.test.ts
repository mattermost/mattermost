// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {WikiTypes} from 'mattermost-redux/action_types';
import {PostTypes} from 'mattermost-redux/constants/posts';

import wikiPagesReducer from './wiki_pages';

describe('wiki_pages reducer', () => {
    const initialState = {
        byWiki: {},
        loading: {},
        error: {},
        pendingPublishes: {},
    };

    const wikiId = 'wiki123';
    const pageId = 'page123';
    const mockPage: Post = {
        id: pageId,
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
        message: 'Page content',
        type: PostTypes.PAGE,
        props: {title: 'Test Page'},
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

    describe('GET_WIKI_PAGES_REQUEST', () => {
        test('should set loading state', () => {
            const action = {
                type: WikiTypes.GET_WIKI_PAGES_REQUEST,
                data: {wikiId},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState.loading[wikiId]).toBe(true);
            expect(nextState.error[wikiId]).toBeNull();
        });
    });

    describe('GET_WIKI_PAGES_SUCCESS', () => {
        test('should store page IDs in byWiki', () => {
            const pages = [mockPage, {...mockPage, id: 'page456'}];
            const action = {
                type: WikiTypes.GET_WIKI_PAGES_SUCCESS,
                data: {wikiId, pages},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page123', 'page456']);
            expect(nextState.loading[wikiId]).toBe(false);
        });

        test('should not store page data (only IDs)', () => {
            const pages = [mockPage];
            const action = {
                type: WikiTypes.GET_WIKI_PAGES_SUCCESS,
                data: {wikiId, pages},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState).not.toHaveProperty('pageSummaries');
            expect(nextState).not.toHaveProperty('fullPages');
        });
    });

    describe('GET_WIKI_PAGES_FAILURE', () => {
        test('should set error state', () => {
            const error = 'Failed to load pages';
            const action = {
                type: WikiTypes.GET_WIKI_PAGES_FAILURE,
                data: {wikiId, error},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState.loading[wikiId]).toBe(false);
            expect(nextState.error[wikiId]).toBe(error);
        });
    });

    describe('RECEIVED_PAGE', () => {
        test('should add page ID to byWiki', () => {
            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: mockPage,
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState.byWiki[wikiId]).toContain(pageId);
        });

        test('should not duplicate page ID if already exists', () => {
            const stateWithPage = {
                ...initialState,
                byWiki: {
                    [wikiId]: [pageId],
                },
            };

            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: mockPage,
            };

            const nextState = wikiPagesReducer(stateWithPage, action);

            expect(nextState.byWiki[wikiId]).toEqual([pageId]);
            expect(nextState.byWiki[wikiId].length).toBe(1);
        });

        test('should append new page to existing list', () => {
            const existingPageId = 'existing-page';
            const stateWithPage = {
                ...initialState,
                byWiki: {
                    [wikiId]: [existingPageId],
                },
            };

            const newPage = {...mockPage, id: 'new-page'};
            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: newPage,
            };

            const nextState = wikiPagesReducer(stateWithPage, action);

            expect(nextState.byWiki[wikiId]).toEqual([existingPageId, 'new-page']);
        });

        test('should not store page content', () => {
            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: mockPage,
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState).not.toHaveProperty('pageSummaries');
            expect(nextState).not.toHaveProperty('fullPages');
        });
    });

    describe('DELETED_PAGE', () => {
        test('should remove page ID from byWiki', () => {
            const stateWithPages = {
                ...initialState,
                byWiki: {
                    [wikiId]: ['page123', 'page456', 'page789'],
                },
            };

            const action = {
                type: WikiTypes.DELETED_PAGE,
                data: {id: 'page456'},
            };

            const nextState = wikiPagesReducer(stateWithPages, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page123', 'page789']);
            expect(nextState.byWiki[wikiId]).not.toContain('page456');
        });

        test('should remove from all wikis', () => {
            const stateWithPages = {
                ...initialState,
                byWiki: {
                    wiki1: ['page123', 'page456'],
                    wiki2: ['page456', 'page789'],
                },
            };

            const action = {
                type: WikiTypes.DELETED_PAGE,
                data: {id: 'page456'},
            };

            const nextState = wikiPagesReducer(stateWithPages, action);

            expect(nextState.byWiki.wiki1).toEqual(['page123']);
            expect(nextState.byWiki.wiki2).toEqual(['page789']);
        });

        test('should not remove from cache (data is in posts store)', () => {
            const action = {
                type: WikiTypes.DELETED_PAGE,
                data: {id: pageId},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState).not.toHaveProperty('pageSummaries');
            expect(nextState).not.toHaveProperty('fullPages');
        });
    });

    describe('PUBLISH_DRAFT_REQUEST', () => {
        test('should set pending publish state', () => {
            const draftId = 'draft123';
            const action = {
                type: WikiTypes.PUBLISH_DRAFT_REQUEST,
                data: {draftId},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState.pendingPublishes[draftId]).toBe(true);
        });
    });

    describe('PUBLISH_DRAFT_SUCCESS', () => {
        test('should clear pending publish state', () => {
            const draftId = 'draft123';
            const stateWithPending = {
                ...initialState,
                pendingPublishes: {
                    [draftId]: true,
                },
            };

            const action = {
                type: WikiTypes.PUBLISH_DRAFT_SUCCESS,
                data: {draftId, pageId: 'page123', optimisticId: 'pending-123'},
            };

            const nextState = wikiPagesReducer(stateWithPending, action);

            expect(nextState.pendingPublishes[draftId]).toBeUndefined();
        });
    });

    describe('PUBLISH_DRAFT_FAILURE', () => {
        test('should clear pending publish state', () => {
            const draftId = 'draft123';
            const stateWithPending = {
                ...initialState,
                pendingPublishes: {
                    [draftId]: true,
                },
            };

            const action = {
                type: WikiTypes.PUBLISH_DRAFT_FAILURE,
                data: {draftId, error: 'Failed to publish'},
            };

            const nextState = wikiPagesReducer(stateWithPending, action);

            expect(nextState.pendingPublishes[draftId]).toBeUndefined();
        });
    });

    describe('PUBLISH_DRAFT_COMPLETED', () => {
        test('should clear pending publish state', () => {
            const draftId = 'draft123';
            const stateWithPending = {
                ...initialState,
                pendingPublishes: {
                    [draftId]: true,
                },
            };

            const action = {
                type: WikiTypes.PUBLISH_DRAFT_COMPLETED,
                data: {draftId},
            };

            const nextState = wikiPagesReducer(stateWithPending, action);

            expect(nextState.pendingPublishes[draftId]).toBeUndefined();
        });
    });

    describe('Single Source of Truth', () => {
        test('should not have pageSummaries cache', () => {
            expect(initialState).not.toHaveProperty('pageSummaries');
        });

        test('should not have fullPages cache', () => {
            expect(initialState).not.toHaveProperty('fullPages');
        });

        test('should only store metadata (byWiki, loading, error)', () => {
            const stateKeys = Object.keys(initialState);
            expect(stateKeys).toContain('byWiki');
            expect(stateKeys).toContain('loading');
            expect(stateKeys).toContain('error');
            expect(stateKeys).toContain('pendingPublishes');
            expect(stateKeys).not.toContain('pageSummaries');
            expect(stateKeys).not.toContain('fullPages');
        });
    });
});
