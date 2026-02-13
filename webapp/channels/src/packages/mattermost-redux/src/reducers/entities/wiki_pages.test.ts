// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {WikiTypes} from 'mattermost-redux/action_types';
import {PostTypes} from 'mattermost-redux/constants/posts';

import wikiPagesReducer from './wiki_pages';

describe('wiki_pages reducer', () => {
    const initialState = {
        byWiki: {},
        lastPagesInvalidated: {},
        lastDraftsInvalidated: {},
        statusField: null,
        publishedDraftTimestamps: {},
        deletedDraftTimestamps: {},
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

    describe('GET_PAGES_SUCCESS', () => {
        test('should store page IDs in byWiki', () => {
            const pages = [mockPage, {...mockPage, id: 'page456'}];
            const action = {
                type: WikiTypes.GET_PAGES_SUCCESS,
                data: {wikiId, pages},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page123', 'page456']);
        });

        test('should not store page data (only IDs)', () => {
            const pages = [mockPage];
            const action = {
                type: WikiTypes.GET_PAGES_SUCCESS,
                data: {wikiId, pages},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState).not.toHaveProperty('pageSummaries');
            expect(nextState).not.toHaveProperty('fullPages');
        });
    });

    describe('RECEIVED_PAGE_IN_WIKI', () => {
        test('should add page ID to byWiki', () => {
            const action = {
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: mockPage, wikiId},
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
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: mockPage, wikiId},
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
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: newPage, wikiId},
            };

            const nextState = wikiPagesReducer(stateWithPage, action);

            expect(nextState.byWiki[wikiId]).toEqual([existingPageId, 'new-page']);
        });

        test('should not store page content', () => {
            const action = {
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: mockPage, wikiId},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState).not.toHaveProperty('pageSummaries');
            expect(nextState).not.toHaveProperty('fullPages');
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
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: realPage, wikiId, pendingPageId},
            };

            const nextState = wikiPagesReducer(stateWithPendingAndReal, action);

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
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: realPage, wikiId, pendingPageId},
            };

            const nextState = wikiPagesReducer(stateWithPending, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page1', 'page2', realPageId]);
            expect(nextState.byWiki[wikiId].length).toBe(3);
        });

        test('should remove duplicates from byWiki array (HA race condition fix)', () => {
            // In HA environments, duplicate WebSocket events can cause the same page ID
            // to be added multiple times due to race conditions. This test ensures
            // that duplicates are cleaned up when processing RECEIVED_PAGE_IN_WIKI.
            const stateWithDuplicates = {
                ...initialState,
                byWiki: {
                    [wikiId]: ['page1', 'page2', 'page2', 'page3', 'page1'],
                },
            };

            const newPage = {...mockPage, id: 'page4'};
            const action = {
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: newPage, wikiId},
            };

            const nextState = wikiPagesReducer(stateWithDuplicates, action);

            expect(nextState.byWiki[wikiId]).toEqual(['page1', 'page2', 'page3', 'page4']);
            expect(nextState.byWiki[wikiId].length).toBe(4);
        });

        test('should handle duplicate page being added via WebSocket (HA scenario)', () => {
            // Simulates HA scenario where the same page is received via multiple WebSocket connections
            const stateWithPage = {
                ...initialState,
                byWiki: {
                    [wikiId]: ['page1', pageId],
                },
            };

            // First WebSocket event adds the page
            const action1 = {
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: mockPage, wikiId},
            };
            const state1 = wikiPagesReducer(stateWithPage, action1);

            // Second WebSocket event (from another HA node) tries to add the same page
            const action2 = {
                type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
                data: {page: mockPage, wikiId},
            };
            const state2 = wikiPagesReducer(state1, action2);

            // Should still have no duplicates
            expect(state2.byWiki[wikiId]).toEqual(['page1', pageId]);
            expect(state2.byWiki[wikiId].length).toBe(2);
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

    describe('PUBLISH_DRAFT_SUCCESS', () => {
        test('should seed publishedDraftTimestamps with server timestamp', () => {
            const pageId = 'page123';
            const publishedAt = 1700000000000;
            const action = {
                type: WikiTypes.PUBLISH_DRAFT_SUCCESS,
                data: {pageId, optimisticId: 'pending-123', publishedAt},
            };

            const nextState = wikiPagesReducer(initialState, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamp, action);

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

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState.publishedDraftTimestamps[draftId]).toBe(publishedAt);
        });

        test('should not update if publishedAt is not provided', () => {
            const draftId = 'draft123';
            const action = {
                type: WikiTypes.DELETED_DRAFT,
                data: {id: draftId, wikiId: 'wiki123'},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState).toBe(initialState);
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

            const nextState = wikiPagesReducer(stateWithTimestamp, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamp, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamps, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamps, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamps, action);

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

            const nextState = wikiPagesReducer(initialState, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamp, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamp, action);

            expect(nextState.deletedDraftTimestamps[draftId]).toBe(existingTimestamp);

            // State reference should not change since nothing was updated
            expect(nextState).toBe(stateWithTimestamp);
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

            const nextState = wikiPagesReducer(stateWithTimestamp, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamp, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamps, action);

            expect(nextState.deletedDraftTimestamps[draftId1]).toBeUndefined();
            expect(nextState.deletedDraftTimestamps[draftId2]).toBe(1700000001000);
        });

        test('should return same state if tombstone does not exist', () => {
            const action = {
                type: WikiTypes.DRAFT_DELETION_REVERTED,
                data: {draftId: 'non-existent-draft'},
            };

            const nextState = wikiPagesReducer(initialState, action);

            expect(nextState).toBe(initialState);
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

            const nextState = wikiPagesReducer(stateWithTimestamps, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamps, action);

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

            const nextState = wikiPagesReducer(stateWithTimestamps, action);

            expect(Object.keys(nextState.deletedDraftTimestamps)).toHaveLength(0);
        });
    });

    describe('Single Source of Truth', () => {
        test('should not have pageSummaries cache', () => {
            expect(initialState).not.toHaveProperty('pageSummaries');
        });

        test('should not have fullPages cache', () => {
            expect(initialState).not.toHaveProperty('fullPages');
        });

        test('should only store metadata (byWiki, publishedDraftTimestamps, deletedDraftTimestamps, etc)', () => {
            const stateKeys = Object.keys(initialState);
            expect(stateKeys).toContain('byWiki');
            expect(stateKeys).toContain('publishedDraftTimestamps');
            expect(stateKeys).toContain('deletedDraftTimestamps');
            expect(stateKeys).not.toContain('pageSummaries');
            expect(stateKeys).not.toContain('fullPages');
        });
    });

    describe('Page Status', () => {
        describe('RECEIVED_PAGE_STATUS_FIELD', () => {
            test('should store status field definition', () => {
                const statusField = {
                    id: 'status_field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {
                        options: [
                            {id: 'rough_draft', name: 'rough_draft', color: 'light_grey'},
                            {id: 'in_progress', name: 'in_progress', color: 'light_blue'},
                            {id: 'in_review', name: 'in_review', color: 'dark_blue'},
                            {id: 'done', name: 'done', color: 'green'},
                        ],
                    },
                };

                const nextState = wikiPagesReducer(initialState, {
                    type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                    data: statusField,
                });

                expect(nextState.statusField).toEqual(statusField);
                expect(nextState.statusField?.attrs?.options).toHaveLength(4);
            });

            test('should replace existing status field', () => {
                const oldField = {
                    id: 'old_field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {
                        options: [{id: 'draft', name: 'draft', color: 'grey'}],
                    },
                };

                const newField = {
                    id: 'new_field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {
                        options: [
                            {id: 'rough_draft', name: 'rough_draft', color: 'light_grey'},
                            {id: 'done', name: 'done', color: 'green'},
                        ],
                    },
                };

                const stateWithOldField = {
                    ...initialState,
                    statusField: oldField as any,
                };

                const nextState = wikiPagesReducer(stateWithOldField as any, {
                    type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                    data: newField,
                });

                expect(nextState.statusField).toEqual(newField);
                expect(nextState.statusField?.id).toBe('new_field_id');
            });
        });

        describe('State immutability', () => {
            test('RECEIVED_PAGE_STATUS_FIELD should not mutate original state', () => {
                const statusField = {
                    id: 'field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {options: [{id: 'draft', name: 'draft', color: 'grey'}]},
                };

                const nextState = wikiPagesReducer(initialState, {
                    type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                    data: statusField,
                });

                expect(nextState).not.toBe(initialState);
                expect(initialState.statusField).toBeNull();
            });
        });
    });
});
