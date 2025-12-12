// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';

import type {GlobalState} from 'types/store';

import {hasUnsavedChanges, hasUnpublishedChanges, makePageDraftKey} from './page_drafts';

const currentUserId = 'user1';
const wikiId = 'wiki1';
const pageId = 'page1';

const initialState = {
    entities: {
        users: {
            currentUserId,
            profiles: {
                [currentUserId]: {
                    id: currentUserId,
                    roles: 'system_role',
                },
            },
        },
        channels: {},
        teams: {},
        general: {
            config: {},
        },
        preferences: {
            myPreferences: {},
        },
        wikiPages: {
            publishedDraftTimestamps: {},
        },
    },
    storage: {
        storage: {},
    },
} as unknown as GlobalState;

describe('page_drafts selectors', () => {
    describe('hasUnsavedChanges', () => {
        describe('empty page content scenarios', () => {
            it('should return false when page is empty and draft has TipTap empty doc structure', () => {
                // Scenario: User opens empty page in Edit mode, TipTap creates empty doc structure
                // After navigating away and back, should NOT show "Unpublished changes"
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: JSON.stringify({type: 'doc', content: []}),
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                // Published page content is empty string
                const publishedContent = '';

                expect(hasUnsavedChanges(state, wikiId, pageId, publishedContent)).toBe(false);
            });

            it('should return false when page is empty and draft has empty doc with empty paragraph', () => {
                // Scenario: TipTap sometimes adds an empty paragraph node
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: JSON.stringify({
                                        type: 'doc',
                                        content: [{type: 'paragraph'}],
                                    }),
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                const publishedContent = '';

                expect(hasUnsavedChanges(state, wikiId, pageId, publishedContent)).toBe(false);
            });

            it('should return false when page is empty and draft has empty doc with empty paragraph with empty content array', () => {
                // Scenario: TipTap empty paragraph with explicit empty content array
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: JSON.stringify({
                                        type: 'doc',
                                        content: [{type: 'paragraph', content: []}],
                                    }),
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                const publishedContent = '';

                expect(hasUnsavedChanges(state, wikiId, pageId, publishedContent)).toBe(false);
            });

            it('should return false when both published and draft have identical TipTap empty doc', () => {
                // Scenario: Published page already has TipTap structure, draft matches
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
                const emptyDoc = JSON.stringify({type: 'doc', content: []});

                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: emptyDoc,
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                expect(hasUnsavedChanges(state, wikiId, pageId, emptyDoc)).toBe(false);
            });
        });

        describe('unmodified page content scenarios', () => {
            it('should return false when page has content and draft has identical content', () => {
                // Scenario: User opens page with content in Edit mode, makes no changes
                // After navigating away and back, should NOT show "Unpublished changes"
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
                const pageContent = JSON.stringify({
                    type: 'doc',
                    content: [
                        {
                            type: 'paragraph',
                            content: [{type: 'text', text: 'Hello World'}],
                        },
                    ],
                });

                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: pageContent,
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                expect(hasUnsavedChanges(state, wikiId, pageId, pageContent)).toBe(false);
            });

            it('should return false when draft and published have same content with different JSON key order', () => {
                // Scenario: JSON serialization may produce different key ordering
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);

                // Draft has keys in one order
                const draftContent = JSON.stringify({
                    type: 'doc',
                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Test'}]}],
                });

                // Published has keys in potentially different order but same structure
                // (In practice, JSON.stringify is deterministic, but isEqual handles this)
                const publishedContent = JSON.stringify({
                    type: 'doc',
                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Test'}]}],
                });

                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: draftContent,
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                expect(hasUnsavedChanges(state, wikiId, pageId, publishedContent)).toBe(false);
            });

            it('should return false when page has complex content and draft matches exactly', () => {
                // Scenario: Page with headings, lists, etc. - no modifications
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
                const complexContent = JSON.stringify({
                    type: 'doc',
                    content: [
                        {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Title'}]},
                        {type: 'paragraph', content: [{type: 'text', text: 'Introduction paragraph.'}]},
                        {
                            type: 'bulletList',
                            content: [
                                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 1'}]}]},
                                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 2'}]}]},
                            ],
                        },
                    ],
                });

                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: complexContent,
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                expect(hasUnsavedChanges(state, wikiId, pageId, complexContent)).toBe(false);
            });

            it('should return false when TipTap adds null attributes to orderedList', () => {
                // Scenario: TipTap normalizes content by adding "type": null to orderedList attrs
                // Published: {type: 'orderedList', attrs: {start: 1}}
                // Draft: {type: 'orderedList', attrs: {type: null, start: 1}}
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);

                // Published content without null attribute
                const publishedContent = JSON.stringify({
                    type: 'doc',
                    content: [
                        {
                            type: 'orderedList',
                            attrs: {start: 1},
                            content: [
                                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 1'}]}]},
                            ],
                        },
                    ],
                });

                // Draft with TipTap-added null attribute
                const draftContent = JSON.stringify({
                    type: 'doc',
                    content: [
                        {
                            type: 'orderedList',
                            attrs: {type: null, start: 1},
                            content: [
                                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 1'}]}]},
                            ],
                        },
                    ],
                });

                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: draftContent,
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                expect(hasUnsavedChanges(state, wikiId, pageId, publishedContent)).toBe(false);
            });

            it('should return false when TipTap adds null attributes in nested structures', () => {
                // Scenario: Multiple orderedLists with null attributes
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);

                const publishedContent = JSON.stringify({
                    type: 'doc',
                    content: [
                        {type: 'heading', attrs: {id: 'title', level: 1}, content: [{type: 'text', text: 'Title'}]},
                        {
                            type: 'orderedList',
                            attrs: {start: 1},
                            content: [{type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'First'}]}]}],
                        },
                        {type: 'paragraph', content: [{type: 'text', text: 'Middle text'}]},
                        {
                            type: 'orderedList',
                            attrs: {start: 1},
                            content: [{type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Second'}]}]}],
                        },
                    ],
                });

                const draftContent = JSON.stringify({
                    type: 'doc',
                    content: [
                        {type: 'heading', attrs: {id: 'title', level: 1}, content: [{type: 'text', text: 'Title'}]},
                        {
                            type: 'orderedList',
                            attrs: {type: null, start: 1},
                            content: [{type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'First'}]}]}],
                        },
                        {type: 'paragraph', content: [{type: 'text', text: 'Middle text'}]},
                        {
                            type: 'orderedList',
                            attrs: {type: null, start: 1},
                            content: [{type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Second'}]}]}],
                        },
                    ],
                });

                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: draftContent,
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                expect(hasUnsavedChanges(state, wikiId, pageId, publishedContent)).toBe(false);
            });
        });

        describe('modified content scenarios (should return true)', () => {
            it('should return true when draft has actual text content but page is empty', () => {
                // Scenario: User added content to an empty page
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: JSON.stringify({
                                        type: 'doc',
                                        content: [{type: 'paragraph', content: [{type: 'text', text: 'New content'}]}],
                                    }),
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                expect(hasUnsavedChanges(state, wikiId, pageId, '')).toBe(true);
            });

            it('should return true when draft content differs from published content', () => {
                // Scenario: User modified existing content
                const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
                const publishedContent = JSON.stringify({
                    type: 'doc',
                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Original'}]}],
                });
                const draftContent = JSON.stringify({
                    type: 'doc',
                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Modified'}]}],
                });

                const state = mergeObjects(initialState, {
                    storage: {
                        storage: {
                            [draftKey]: {
                                value: {
                                    message: draftContent,
                                    fileInfos: [],
                                    uploadsInProgress: [],
                                    channelId: 'channel1',
                                    wikiId,
                                    rootId: pageId,
                                    createAt: Date.now(),
                                    updateAt: Date.now(),
                                    show: true,
                                },
                                timestamp: new Date(),
                            },
                        },
                    },
                });

                expect(hasUnsavedChanges(state, wikiId, pageId, publishedContent)).toBe(true);
            });
        });

        describe('no draft scenarios', () => {
            it('should return false when no draft exists', () => {
                // Scenario: Page viewed without entering Edit mode
                expect(hasUnsavedChanges(initialState, wikiId, pageId, 'any content')).toBe(false);
            });
        });
    });

    describe('hasUnpublishedChanges', () => {
        it('should delegate to hasUnsavedChanges', () => {
            // hasUnpublishedChanges is an alias for hasUnsavedChanges
            const draftKey = makePageDraftKey(wikiId, pageId, currentUserId);
            const state = mergeObjects(initialState, {
                storage: {
                    storage: {
                        [draftKey]: {
                            value: {
                                message: JSON.stringify({type: 'doc', content: []}),
                                fileInfos: [],
                                uploadsInProgress: [],
                                channelId: 'channel1',
                                wikiId,
                                rootId: pageId,
                                createAt: Date.now(),
                                updateAt: Date.now(),
                                show: true,
                            },
                            timestamp: new Date(),
                        },
                    },
                },
            });

            // Both should return the same result
            expect(hasUnpublishedChanges(state, wikiId, pageId, '')).toBe(
                hasUnsavedChanges(state, wikiId, pageId, ''),
            );
        });
    });
});
