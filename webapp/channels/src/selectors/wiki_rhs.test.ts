// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import {
    getWikiRhsWikiId,
    getWikiRhsMode,
    getSelectedPageId,
    getFocusedInlineCommentId,
    getWikiRhsActiveTab,
} from './wiki_rhs';

describe('wiki_rhs selectors', () => {
    const baseState = {
        views: {
            wikiRhs: {
                wikiId: 'wiki123',
                mode: 'outline' as const,
                selectedPageId: 'page123',
                focusedInlineCommentId: 'comment123',
                activeTab: 'page_comments' as const,
            },
        },
    } as unknown as GlobalState;

    describe('getWikiRhsWikiId', () => {
        test('should return wikiId when present', () => {
            expect(getWikiRhsWikiId(baseState)).toBe('wiki123');
        });

        test('should return null when wikiId is not set', () => {
            const state = {
                views: {
                    wikiRhs: {
                        ...baseState.views.wikiRhs,
                        wikiId: null,
                    },
                },
            } as unknown as GlobalState;

            expect(getWikiRhsWikiId(state)).toBe(null);
        });

        test('should return null when wikiRhs is undefined', () => {
            const state = {
                views: {},
            } as unknown as GlobalState;

            expect(getWikiRhsWikiId(state)).toBe(null);
        });
    });

    describe('getWikiRhsMode', () => {
        test('should return mode when set to outline', () => {
            expect(getWikiRhsMode(baseState)).toBe('outline');
        });

        test('should return mode when set to comments', () => {
            const state = {
                views: {
                    wikiRhs: {
                        ...baseState.views.wikiRhs,
                        mode: 'comments' as const,
                    },
                },
            } as unknown as GlobalState;

            expect(getWikiRhsMode(state)).toBe('comments');
        });

        test('should return outline as default when wikiRhs is undefined', () => {
            const state = {
                views: {},
            } as unknown as GlobalState;

            expect(getWikiRhsMode(state)).toBe('outline');
        });
    });

    describe('getSelectedPageId', () => {
        test('should return selectedPageId when present', () => {
            expect(getSelectedPageId(baseState)).toBe('page123');
        });

        test('should return empty string when selectedPageId is not set', () => {
            const state = {
                views: {
                    wikiRhs: {
                        ...baseState.views.wikiRhs,
                        selectedPageId: '',
                    },
                },
            } as unknown as GlobalState;

            expect(getSelectedPageId(state)).toBe('');
        });

        test('should return empty string when wikiRhs is undefined', () => {
            const state = {
                views: {},
            } as unknown as GlobalState;

            expect(getSelectedPageId(state)).toBe('');
        });
    });

    describe('getFocusedInlineCommentId', () => {
        test('should return focusedInlineCommentId when present', () => {
            expect(getFocusedInlineCommentId(baseState)).toBe('comment123');
        });

        test('should return null when focusedInlineCommentId is not set', () => {
            const state = {
                views: {
                    wikiRhs: {
                        ...baseState.views.wikiRhs,
                        focusedInlineCommentId: null,
                    },
                },
            } as unknown as GlobalState;

            expect(getFocusedInlineCommentId(state)).toBe(null);
        });

        test('should return null when wikiRhs is undefined', () => {
            const state = {
                views: {},
            } as unknown as GlobalState;

            expect(getFocusedInlineCommentId(state)).toBe(null);
        });
    });

    describe('getWikiRhsActiveTab', () => {
        test('should return page_comments when set', () => {
            expect(getWikiRhsActiveTab(baseState)).toBe('page_comments');
        });

        test('should return all_threads when set', () => {
            const state = {
                views: {
                    wikiRhs: {
                        ...baseState.views.wikiRhs,
                        activeTab: 'all_threads' as const,
                    },
                },
            } as unknown as GlobalState;

            expect(getWikiRhsActiveTab(state)).toBe('all_threads');
        });

        test('should return page_comments as default when wikiRhs is undefined', () => {
            const state = {
                views: {},
            } as unknown as GlobalState;

            expect(getWikiRhsActiveTab(state)).toBe('page_comments');
        });
    });
});
