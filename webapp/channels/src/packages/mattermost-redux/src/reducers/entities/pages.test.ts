// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {WikiTypes} from 'mattermost-redux/action_types';
import {PostTypes} from 'mattermost-redux/constants/posts';

import {makeInitialPagesState} from 'tests/helpers/pages_state';

import pagesReducer from './pages';

describe('pages reducer', () => {
    const initialState = makeInitialPagesState();

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

    describe('RECEIVED_PAGES (replaces GET_PAGES_SUCCESS)', () => {
        test('should store page IDs in byWiki', () => {
            const pages = [mockPage, {...mockPage, id: 'page456'}];
            const action = {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId, pages},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page123', 'page456']);
        });

        test('should store pages in byId', () => {
            const pages = [mockPage];
            const action = {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId, pages},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.byId[pageId]).toEqual(mockPage);
        });
    });

    describe('RECEIVED_PAGE', () => {
        test('should add page ID to byWiki', () => {
            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: mockPage, wikiId},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.byWiki[wikiId]).toContain(pageId);
        });

        test('should add page to byId', () => {
            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: mockPage, wikiId},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.byId[pageId]).toEqual(mockPage);
        });

        test('should not duplicate page ID if already exists', () => {
            const stateWithPage = {
                ...initialState,
                byId: {[pageId]: mockPage},
                byWiki: {
                    [wikiId]: [pageId],
                },
            };

            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: mockPage, wikiId},
            };

            const nextState = pagesReducer(stateWithPage as any, action);

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
                data: {page: newPage, wikiId},
            };

            const nextState = pagesReducer(stateWithPage as any, action);

            expect(nextState.byWiki[wikiId]).toEqual([existingPageId, 'new-page']);
        });

        test('should replace pending page ID with real ID without creating duplicates', () => {
            const pendingPageId = 'pending-123';
            const realPageId = 'real-abc';
            const stateWithPendingAndReal = {
                ...initialState,
                byWiki: {
                    [wikiId]: ['page1', 'page2', pendingPageId, realPageId],
                },
            };

            const realPage = {...mockPage, id: realPageId};
            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: realPage, wikiId, pendingPageId},
            };

            const nextState = pagesReducer(stateWithPendingAndReal as any, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page1', 'page2', realPageId]);
            expect(nextState.byWiki[wikiId].length).toBe(3);
            expect(nextState.byWiki[wikiId].filter((id) => id === realPageId).length).toBe(1);
        });

        test('should replace pending page ID with real ID when real ID does not exist', () => {
            const pendingPageId = 'pending-123';
            const realPageId = 'real-abc';
            const stateWithPending = {
                ...initialState,
                byWiki: {
                    [wikiId]: ['page1', 'page2', pendingPageId],
                },
            };

            const realPage = {...mockPage, id: realPageId};
            const action = {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: realPage, wikiId, pendingPageId},
            };

            const nextState = pagesReducer(stateWithPending as any, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page1', 'page2', realPageId]);
            expect(nextState.byWiki[wikiId].length).toBe(3);
        });

        test('should handle duplicate page being added via WebSocket (HA scenario)', () => {
            const stateWithPage = {
                ...initialState,
                byId: {[pageId]: mockPage, page1: {...mockPage, id: 'page1'}},
                byWiki: {
                    [wikiId]: ['page1', pageId],
                },
            };

            const action1 = {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: mockPage, wikiId},
            };
            const state1 = pagesReducer(stateWithPage as any, action1);

            const action2 = {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: mockPage, wikiId},
            };
            const state2 = pagesReducer(state1, action2);

            expect(state2.byWiki[wikiId]).toEqual(['page1', pageId]);
            expect(state2.byWiki[wikiId].length).toBe(2);
        });
    });

    describe('DELETED_PAGE', () => {
        test('should remove page ID from byWiki', () => {
            const stateWithPages = {
                ...initialState,
                byId: {page123: mockPage, page456: {...mockPage, id: 'page456'}, page789: {...mockPage, id: 'page789'}},
                byWiki: {
                    [wikiId]: ['page123', 'page456', 'page789'],
                },
            };

            const action = {
                type: WikiTypes.DELETED_PAGE,
                data: {id: 'page456'},
            };

            const nextState = pagesReducer(stateWithPages as any, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page123', 'page789']);
            expect(nextState.byWiki[wikiId]).not.toContain('page456');
        });

        test('should remove from all wikis', () => {
            const stateWithPages = {
                ...initialState,
                byId: {page123: mockPage, page456: {...mockPage, id: 'page456'}, page789: {...mockPage, id: 'page789'}},
                byWiki: {
                    wiki1: ['page123', 'page456'],
                    wiki2: ['page456', 'page789'],
                },
            };

            const action = {
                type: WikiTypes.DELETED_PAGE,
                data: {id: 'page456'},
            };

            const nextState = pagesReducer(stateWithPages as any, action);

            expect(nextState.byWiki.wiki1).toEqual(['page123']);
            expect(nextState.byWiki.wiki2).toEqual(['page789']);
        });

        test('should soft-delete page in byId (existing entry gets state=DELETED)', () => {
            const stateWithPage = {
                ...initialState,
                byId: {[pageId]: mockPage},
                byWiki: {[wikiId]: [pageId]},
            };

            const action = {
                type: WikiTypes.DELETED_PAGE,
                data: {id: pageId},
            };

            const nextState = pagesReducer(stateWithPage as any, action);

            expect(nextState.byId[pageId]).toEqual({...mockPage, state: 'DELETED'});
        });

        test('should create minimal tombstone when page is not already in byId', () => {
            const action = {
                type: WikiTypes.DELETED_PAGE,
                data: {id: pageId},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.byId[pageId]).toEqual({id: pageId, state: 'DELETED', type: PostTypes.PAGE});
        });

        // Core correctness invariant: once a page is tombstoned, a late-arriving
        // WebSocket RECEIVED_PAGE (e.g. PAGE_PUBLISHED echo for a page the user
        // just deleted) must NOT resurrect it in byId.
        test('should NOT reanimate a tombstoned page on subsequent RECEIVED_PAGE', () => {
            const stateWithPage = {
                ...initialState,
                byId: {[pageId]: mockPage},
                byWiki: {[wikiId]: [pageId]},
            };

            const afterDelete = pagesReducer(stateWithPage as any, {
                type: WikiTypes.DELETED_PAGE,
                data: {id: pageId, wikiId},
            });

            expect(afterDelete.byId[pageId].state).toBe('DELETED');

            const lateArrival: Post = {...mockPage, edit_at: 2000000000, message: 'resurrected'};
            const afterLateArrival = pagesReducer(afterDelete, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: lateArrival, wikiId},
            });

            // Tombstone must survive — neither state nor content should change.
            expect(afterLateArrival.byId[pageId].state).toBe('DELETED');
            expect(afterLateArrival.byId[pageId].message).toBe(mockPage.message);
        });

        // Optimistic-delete rollback path: actions/pages.ts deletePage() dispatches
        // RECEIVED_PAGE with isRevert=true when the API call fails, to restore the
        // page. The tombstone guard must bypass only when isRevert is explicitly set.
        test('RECEIVED_PAGE with isRevert=true should restore a tombstoned page', () => {
            const stateWithTombstone = pagesReducer(
                {...initialState, byId: {[pageId]: mockPage}, byWiki: {[wikiId]: [pageId]}} as any,
                {type: WikiTypes.DELETED_PAGE, data: {id: pageId, wikiId}},
            );

            expect(stateWithTombstone.byId[pageId].state).toBe('DELETED');

            const restored = pagesReducer(stateWithTombstone, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: mockPage, wikiId, isRevert: true},
            });

            expect(restored.byId[pageId]).toEqual(mockPage);
            expect(restored.byId[pageId].state).toBeUndefined();
        });
    });

    describe('PUBLISH_DRAFT_SUCCESS', () => {
        test('should seed publishedDraftTimestamps with server timestamp', () => {
            const publishedAt = 1700000000000;
            const action = {
                type: WikiTypes.PUBLISH_DRAFT_SUCCESS,
                data: {pageId, optimisticId: 'pending-123', publishedAt},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.publishedDraftTimestamps[pageId]).toBe(publishedAt);
        });

        test('should preserve existing timestamps when adding new one', () => {
            const existingPageId = 'existing-page';
            const existingTimestamp = 1600000000000;
            const stateWithTimestamp = {
                ...initialState,
                publishedDraftTimestamps: {
                    [existingPageId]: existingTimestamp,
                },
            };

            const newPageId = 'page456';
            const newTimestamp = 1700000000000;
            const action = {
                type: WikiTypes.PUBLISH_DRAFT_SUCCESS,
                data: {pageId: newPageId, publishedAt: newTimestamp},
            };

            const nextState = pagesReducer(stateWithTimestamp as any, action);

            expect(nextState.publishedDraftTimestamps[existingPageId]).toBe(existingTimestamp);
            expect(nextState.publishedDraftTimestamps[newPageId]).toBe(newTimestamp);
        });
    });

    describe('DELETED_DRAFT', () => {
        test('should record timestamp when publishedAt is provided', () => {
            const draftId = 'draft123';
            const publishedAt = 1700000000000;
            const action = {
                type: WikiTypes.DELETED_DRAFT,
                data: {id: draftId, wikiId: 'wiki123', publishedAt},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.publishedDraftTimestamps[draftId]).toBe(publishedAt);
        });

        test('should not update if publishedAt is not provided', () => {
            const draftId = 'draft123';
            const action = {
                type: WikiTypes.DELETED_DRAFT,
                data: {id: draftId, wikiId: 'wiki123'},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.publishedDraftTimestamps[draftId]).toBeUndefined();
        });

        test('should not update if new timestamp is older than existing', () => {
            const draftId = 'draft123';
            const existingTimestamp = 1700000000000;
            const stateWithTimestamp = {
                ...initialState,
                publishedDraftTimestamps: {
                    [draftId]: existingTimestamp,
                },
            };

            const olderTimestamp = 1600000000000;
            const action = {
                type: WikiTypes.DELETED_DRAFT,
                data: {id: draftId, wikiId: 'wiki123', publishedAt: olderTimestamp},
            };

            const nextState = pagesReducer(stateWithTimestamp as any, action);

            expect(nextState.publishedDraftTimestamps[draftId]).toBe(existingTimestamp);
        });

        test('should update if new timestamp is newer than existing', () => {
            const draftId = 'draft123';
            const existingTimestamp = 1600000000000;
            const stateWithTimestamp = {
                ...initialState,
                publishedDraftTimestamps: {
                    [draftId]: existingTimestamp,
                },
            };

            const newerTimestamp = 1700000000000;
            const action = {
                type: WikiTypes.DELETED_DRAFT,
                data: {id: draftId, wikiId: 'wiki123', publishedAt: newerTimestamp},
            };

            const nextState = pagesReducer(stateWithTimestamp as any, action);

            expect(nextState.publishedDraftTimestamps[draftId]).toBe(newerTimestamp);
        });
    });

    describe('CLEANUP_PUBLISHED_DRAFT_TIMESTAMPS', () => {
        test('should remove entries older than staleThreshold', () => {
            const oldDraftId = 'old-draft';
            const newDraftId = 'new-draft';
            const oldTimestamp = 1600000000000;
            const newTimestamp = 1700000000000;
            const staleThreshold = 1650000000000;

            const stateWithTimestamps = {
                ...initialState,
                publishedDraftTimestamps: {
                    [oldDraftId]: oldTimestamp,
                    [newDraftId]: newTimestamp,
                },
            };

            const action = {
                type: WikiTypes.CLEANUP_PUBLISHED_DRAFT_TIMESTAMPS,
                data: {staleThreshold},
            };

            const nextState = pagesReducer(stateWithTimestamps as any, action);

            expect(nextState.publishedDraftTimestamps[oldDraftId]).toBeUndefined();
            expect(nextState.publishedDraftTimestamps[newDraftId]).toBe(newTimestamp);
        });

        test('should keep entries newer than staleThreshold', () => {
            const draftId1 = 'draft1';
            const draftId2 = 'draft2';
            const timestamp1 = 1700000000000;
            const timestamp2 = 1700000001000;
            const staleThreshold = 1600000000000;

            const stateWithTimestamps = {
                ...initialState,
                publishedDraftTimestamps: {
                    [draftId1]: timestamp1,
                    [draftId2]: timestamp2,
                },
            };

            const action = {
                type: WikiTypes.CLEANUP_PUBLISHED_DRAFT_TIMESTAMPS,
                data: {staleThreshold},
            };

            const nextState = pagesReducer(stateWithTimestamps as any, action);

            expect(nextState.publishedDraftTimestamps[draftId1]).toBe(timestamp1);
            expect(nextState.publishedDraftTimestamps[draftId2]).toBe(timestamp2);
        });

        test('should remove all entries when all are stale', () => {
            const draftId1 = 'draft1';
            const draftId2 = 'draft2';
            const timestamp1 = 1600000000000;
            const timestamp2 = 1600000001000;
            const staleThreshold = 1700000000000;

            const stateWithTimestamps = {
                ...initialState,
                publishedDraftTimestamps: {
                    [draftId1]: timestamp1,
                    [draftId2]: timestamp2,
                },
            };

            const action = {
                type: WikiTypes.CLEANUP_PUBLISHED_DRAFT_TIMESTAMPS,
                data: {staleThreshold},
            };

            const nextState = pagesReducer(stateWithTimestamps as any, action);

            expect(Object.keys(nextState.publishedDraftTimestamps)).toHaveLength(0);
        });
    });

    describe('DRAFT_DELETION_RECORDED', () => {
        test('should store deletion timestamp', () => {
            const draftId = 'draft123';
            const deletedAt = 1700000000000;
            const action = {
                type: WikiTypes.DRAFT_DELETION_RECORDED,
                data: {draftId, deletedAt},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.deletedDraftTimestamps[draftId]).toBe(deletedAt);
        });

        test('should preserve existing timestamps when adding new one', () => {
            const existingDraftId = 'existing-draft';
            const existingTimestamp = 1600000000000;
            const stateWithTimestamp = {
                ...initialState,
                deletedDraftTimestamps: {
                    [existingDraftId]: existingTimestamp,
                },
            };

            const newDraftId = 'draft456';
            const newTimestamp = 1700000000000;
            const action = {
                type: WikiTypes.DRAFT_DELETION_RECORDED,
                data: {draftId: newDraftId, deletedAt: newTimestamp},
            };

            const nextState = pagesReducer(stateWithTimestamp as any, action);

            expect(nextState.deletedDraftTimestamps[existingDraftId]).toBe(existingTimestamp);
            expect(nextState.deletedDraftTimestamps[newDraftId]).toBe(newTimestamp);
        });

        test('should not update if new timestamp is older than existing (idempotent)', () => {
            const draftId = 'draft123';
            const existingTimestamp = 1700000000000;
            const stateWithTimestamp = {
                ...initialState,
                deletedDraftTimestamps: {
                    [draftId]: existingTimestamp,
                },
            };

            const olderTimestamp = 1600000000000;
            const action = {
                type: WikiTypes.DRAFT_DELETION_RECORDED,
                data: {draftId, deletedAt: olderTimestamp},
            };

            const nextState = pagesReducer(stateWithTimestamp as any, action);

            expect(nextState.deletedDraftTimestamps[draftId]).toBe(existingTimestamp);
        });

        test('should update if new timestamp is newer than existing', () => {
            const draftId = 'draft123';
            const existingTimestamp = 1600000000000;
            const stateWithTimestamp = {
                ...initialState,
                deletedDraftTimestamps: {
                    [draftId]: existingTimestamp,
                },
            };

            const newerTimestamp = 1700000000000;
            const action = {
                type: WikiTypes.DRAFT_DELETION_RECORDED,
                data: {draftId, deletedAt: newerTimestamp},
            };

            const nextState = pagesReducer(stateWithTimestamp as any, action);

            expect(nextState.deletedDraftTimestamps[draftId]).toBe(newerTimestamp);
        });
    });

    describe('DRAFT_DELETION_REVERTED', () => {
        test('should remove tombstone when API delete fails', () => {
            const draftId = 'draft123';
            const stateWithTimestamp = {
                ...initialState,
                deletedDraftTimestamps: {
                    [draftId]: 1700000000000,
                },
            };

            const action = {
                type: WikiTypes.DRAFT_DELETION_REVERTED,
                data: {draftId},
            };

            const nextState = pagesReducer(stateWithTimestamp as any, action);

            expect(nextState.deletedDraftTimestamps[draftId]).toBeUndefined();
        });

        test('should preserve other tombstones when reverting one', () => {
            const draftId1 = 'draft1';
            const draftId2 = 'draft2';
            const stateWithTimestamps = {
                ...initialState,
                deletedDraftTimestamps: {
                    [draftId1]: 1700000000000,
                    [draftId2]: 1700000001000,
                },
            };

            const action = {
                type: WikiTypes.DRAFT_DELETION_REVERTED,
                data: {draftId: draftId1},
            };

            const nextState = pagesReducer(stateWithTimestamps as any, action);

            expect(nextState.deletedDraftTimestamps[draftId1]).toBeUndefined();
            expect(nextState.deletedDraftTimestamps[draftId2]).toBe(1700000001000);
        });

        test('should return same state if tombstone does not exist', () => {
            const action = {
                type: WikiTypes.DRAFT_DELETION_REVERTED,
                data: {draftId: 'non-existent-draft'},
            };

            const nextState = pagesReducer(initialState as any, action);

            expect(nextState.deletedDraftTimestamps).toEqual({});
        });
    });

    describe('CLEANUP_DELETED_DRAFT_TIMESTAMPS', () => {
        test('should remove entries older than staleThreshold', () => {
            const oldDraftId = 'old-draft';
            const newDraftId = 'new-draft';
            const oldTimestamp = 1600000000000;
            const newTimestamp = 1700000000000;
            const staleThreshold = 1650000000000;

            const stateWithTimestamps = {
                ...initialState,
                deletedDraftTimestamps: {
                    [oldDraftId]: oldTimestamp,
                    [newDraftId]: newTimestamp,
                },
            };

            const action = {
                type: WikiTypes.CLEANUP_DELETED_DRAFT_TIMESTAMPS,
                data: {staleThreshold},
            };

            const nextState = pagesReducer(stateWithTimestamps as any, action);

            expect(nextState.deletedDraftTimestamps[oldDraftId]).toBeUndefined();
            expect(nextState.deletedDraftTimestamps[newDraftId]).toBe(newTimestamp);
        });

        test('should keep entries newer than staleThreshold', () => {
            const draftId1 = 'draft1';
            const draftId2 = 'draft2';
            const timestamp1 = 1700000000000;
            const timestamp2 = 1700000001000;
            const staleThreshold = 1600000000000;

            const stateWithTimestamps = {
                ...initialState,
                deletedDraftTimestamps: {
                    [draftId1]: timestamp1,
                    [draftId2]: timestamp2,
                },
            };

            const action = {
                type: WikiTypes.CLEANUP_DELETED_DRAFT_TIMESTAMPS,
                data: {staleThreshold},
            };

            const nextState = pagesReducer(stateWithTimestamps as any, action);

            expect(nextState.deletedDraftTimestamps[draftId1]).toBe(timestamp1);
            expect(nextState.deletedDraftTimestamps[draftId2]).toBe(timestamp2);
        });

        test('should remove all entries when all are stale', () => {
            const draftId1 = 'draft1';
            const draftId2 = 'draft2';
            const timestamp1 = 1600000000000;
            const timestamp2 = 1600000001000;
            const staleThreshold = 1700000000000;

            const stateWithTimestamps = {
                ...initialState,
                deletedDraftTimestamps: {
                    [draftId1]: timestamp1,
                    [draftId2]: timestamp2,
                },
            };

            const action = {
                type: WikiTypes.CLEANUP_DELETED_DRAFT_TIMESTAMPS,
                data: {staleThreshold},
            };

            const nextState = pagesReducer(stateWithTimestamps as any, action);

            expect(Object.keys(nextState.deletedDraftTimestamps)).toHaveLength(0);
        });
    });

    describe('LOGOUT_SUCCESS', () => {
        test('should reset all sub-slices to their initial values', () => {
            const populated = {
                byId: {[pageId]: mockPage},
                byWiki: {[wikiId]: [pageId]},
                lastPagesInvalidated: {[wikiId]: 1},
                lastDraftsInvalidated: {[wikiId]: 2},
                publishedDraftTimestamps: {[pageId]: 3},
                deletedDraftTimestamps: {d1: 4},
            };

            const result = pagesReducer(populated, {type: 'LOGOUT_SUCCESS'});

            expect(result).toEqual(initialState);
        });
    });

    describe('RECEIVED_PAGE guards', () => {
        test('should no-op when page is null', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: null, wikiId},
            });
            expect(result).toBe(initialState);
        });

        test('should no-op when page.id is missing', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: {...mockPage, id: ''}, wikiId},
            });
            expect(result).toBe(initialState);
        });

        test('should store in byId but skip byWiki when wikiId is absent', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: mockPage},
            });
            expect(result.byId[pageId]).toEqual(mockPage);
            expect(result.byWiki).toEqual({});
        });

        test('should not overwrite a fresher existing page (edit_at guard)', () => {
            const fresher = {...mockPage, edit_at: 2000};
            const stale = {...mockPage, edit_at: 1000, message: 'stale'};
            const state = {...initialState, byId: {[pageId]: fresher}};

            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: stale, wikiId},
            });
            expect(result.byId[pageId]).toEqual(fresher);
        });

        test('should always replace a pending-* optimistic entry', () => {
            const pending = {...mockPage, id: 'pending-abc', edit_at: 5000};
            const real = {...mockPage, id: 'real-id', edit_at: 0};
            const state = {
                ...initialState,
                byId: {[pending.id]: pending},
                byWiki: {[wikiId]: [pending.id]},
            };

            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: real, wikiId, pendingPageId: pending.id},
            });
            expect(result.byId[real.id]).toEqual(real);
            expect(result.byId[pending.id]).toBeUndefined();
        });
    });

    describe('RECEIVED_PAGES guards', () => {
        test('should initialise byWiki[wikiId] to an empty array for empty pages', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId, pages: []},
            });
            expect(result.byWiki[wikiId]).toEqual([]);
        });

        test('should tolerate missing pages array', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId},
            });
            expect(result.byWiki[wikiId]).toEqual([]);
        });
    });

    describe('REMOVED_PAGE_FROM_WIKI', () => {
        test('should drop the pageId from byWiki[wikiId]', () => {
            const state = {...initialState, byWiki: {[wikiId]: [pageId, 'other']}};
            const result = pagesReducer(state, {
                type: WikiTypes.REMOVED_PAGE_FROM_WIKI,
                data: {pageId, wikiId},
            });
            expect(result.byWiki[wikiId]).toEqual(['other']);
        });

        test('should no-op when the wiki is absent', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.REMOVED_PAGE_FROM_WIKI,
                data: {pageId, wikiId: 'missing'},
            });
            expect(result.byWiki).toEqual({});
        });
    });

    describe('DELETED_WIKI', () => {
        test('should clear byWiki and invalidation timestamps for that wiki', () => {
            const state = {
                ...initialState,
                byWiki: {[wikiId]: [pageId], other: ['p2']},
                lastPagesInvalidated: {[wikiId]: 111, other: 222},
                lastDraftsInvalidated: {[wikiId]: 333, other: 444},
            };
            const result = pagesReducer(state, {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId},
            });
            expect(result.byWiki).toEqual({other: ['p2']});
            expect(result.lastPagesInvalidated).toEqual({other: 222});
            expect(result.lastDraftsInvalidated).toEqual({other: 444});
        });
    });

    describe('INVALIDATE_PAGES / INVALIDATE_DRAFTS', () => {
        test('INVALIDATE_PAGES writes the timestamp', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.INVALIDATE_PAGES,
                data: {wikiId, timestamp: 42},
            });
            expect(result.lastPagesInvalidated[wikiId]).toBe(42);
        });

        test('INVALIDATE_DRAFTS writes the timestamp', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.INVALIDATE_DRAFTS,
                data: {wikiId, timestamp: 99},
            });
            expect(result.lastDraftsInvalidated[wikiId]).toBe(99);
        });
    });

    describe('shouldReplacePage freshness (edit_at only)', () => {
        test('should accept incoming when both sides lack edit_at', () => {
            const existing = {...mockPage, edit_at: 0, update_at: 9999};
            const incoming = {...mockPage, edit_at: 0, update_at: 1, message: 'new'};
            const state = {...initialState, byId: {[pageId]: existing}};
            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: incoming, wikiId},
            });
            expect(result.byId[pageId].message).toBe('new');
        });

        test('should not use update_at fallback when existing has server edit_at', () => {
            // Simulates clock skew: optimistic update_at > server edit_at.
            // Under the old edit_at||update_at rule the reducer would drop the
            // authoritative server response; under the new rule it accepts it.
            const existing = {...mockPage, edit_at: 1000, update_at: 9_999_999_999};
            const incoming = {...mockPage, edit_at: 2000, update_at: 1, message: 'server'};
            const state = {...initialState, byId: {[pageId]: existing}};
            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: incoming, wikiId},
            });
            expect(result.byId[pageId].message).toBe('server');
        });

        test('should accept when existing has no edit_at even if incoming edit_at is lower', () => {
            const existing = {...mockPage, edit_at: 0};
            const incoming = {...mockPage, edit_at: 1, message: 'new'};
            const state = {...initialState, byId: {[pageId]: existing}};
            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: incoming, wikiId},
            });
            expect(result.byId[pageId].message).toBe('new');
        });
    });

    describe('RECEIVED_PAGE with pendingPageId — freshness guard applies to real-id slot', () => {
        test('should not clobber a fresher WS-written real entry when swapping pending', () => {
            const pending = {...mockPage, id: 'pending-abc', edit_at: 0};

            // A WebSocket event already delivered a fresher server version for real-id.
            const wsDelivered = {...mockPage, id: 'real-id', edit_at: 5000, message: 'from WS'};

            // The thunk success dispatch then arrives with the stale publish response.
            const thunkResponse = {...mockPage, id: 'real-id', edit_at: 2000, message: 'from thunk (stale)'};
            const state = {
                ...initialState,
                byId: {[pending.id]: pending, [wsDelivered.id]: wsDelivered},
                byWiki: {[wikiId]: [pending.id, wsDelivered.id]},
            };
            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: thunkResponse, wikiId, pendingPageId: pending.id},
            });

            // Pending is cleared, real-id retains the fresher WS entry.
            expect(result.byId[pending.id]).toBeUndefined();
            expect(result.byId['real-id'].message).toBe('from WS');
        });
    });

    describe('byWiki RECEIVED_PAGES merge', () => {
        test('should preserve pages added via WebSocket during in-flight fetch', () => {
            // State before dispatch: ws-added arrived while fetch was in flight.
            const state = {
                ...initialState,
                byWiki: {[wikiId]: ['p1', 'ws-added']},
            };

            // Fetch result omits ws-added (server snapshot was taken before WS).
            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId, pages: [{...mockPage, id: 'p1'}, {...mockPage, id: 'p2'}]},
            });
            expect(result.byWiki[wikiId]).toEqual(['p1', 'p2', 'ws-added']);
        });

        test('should drop pending-* ids so they do not leak after the real ids are returned', () => {
            const state = {
                ...initialState,
                byWiki: {[wikiId]: ['pending-abc', 'p1']},
            };
            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId, pages: [{...mockPage, id: 'p1'}, {...mockPage, id: 'real-abc'}]},
            });
            expect(result.byWiki[wikiId]).toEqual(['p1', 'real-abc']);
            expect(result.byWiki[wikiId]).not.toContain('pending-abc');
        });

        test('should dedupe duplicate ids in the fetched list (HA guard)', () => {
            const result = pagesReducer(initialState, {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId, pages: [{...mockPage, id: 'p1'}, {...mockPage, id: 'p1'}, {...mockPage, id: 'p2'}]},
            });
            expect(result.byWiki[wikiId]).toEqual(['p1', 'p2']);
        });
    });

    describe('RECEIVED_PAGES message preservation', () => {
        test('should keep existing non-empty message when list endpoint returns empty content', () => {
            const existing = {...mockPage, message: 'loaded content'};
            const stubFromList = {...mockPage, message: ''};
            const state = {...initialState, byId: {[pageId]: existing}};
            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId, pages: [stubFromList]},
            });
            expect(result.byId[pageId].message).toBe('loaded content');
        });

        test('should overwrite with incoming message when incoming has content', () => {
            const existing = {...mockPage, message: 'old'};
            const incoming = {...mockPage, message: 'new', edit_at: 9999};
            const state = {...initialState, byId: {[pageId]: existing}};
            const result = pagesReducer(state, {
                type: WikiTypes.RECEIVED_PAGES,
                data: {wikiId, pages: [incoming]},
            });
            expect(result.byId[pageId].message).toBe('new');
        });
    });

    describe('Single Source of Truth', () => {
        // These tests assert against the reducer's ACTUAL default state, not the
        // test-local `initialState` constant. Asserting on the constant would pass
        // even if a new sub-slice were added to the reducer.
        const defaultState = pagesReducer(undefined, {type: '@@INIT'} as any);

        test('should not have pageSummaries cache', () => {
            expect(defaultState).not.toHaveProperty('pageSummaries');
        });

        test('should not have fullPages cache', () => {
            expect(defaultState).not.toHaveProperty('fullPages');
        });

        test('should only store metadata (byId, byWiki, publishedDraftTimestamps, deletedDraftTimestamps, etc)', () => {
            const stateKeys = Object.keys(defaultState);
            expect(stateKeys).toContain('byId');
            expect(stateKeys).toContain('byWiki');
            expect(stateKeys).toContain('publishedDraftTimestamps');
            expect(stateKeys).toContain('deletedDraftTimestamps');
            expect(stateKeys).not.toContain('pageSummaries');
            expect(stateKeys).not.toContain('fullPages');
        });
    });
});
