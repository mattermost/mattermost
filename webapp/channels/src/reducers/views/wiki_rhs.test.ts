// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes, WikiRhsTypes} from 'utils/constants';

import wikiRhsReducer, {type WikiRhsState} from './wiki_rhs';

describe('reducers/views/wiki_rhs', () => {
    const initialState: WikiRhsState = {
        mode: 'outline',
        wikiId: null,
        selectedPageId: '',
        focusedInlineCommentId: null,
        activeTab: 'page_comments',
        pendingInlineAnchor: null,
        isSubmittingComment: false,
    };

    test('should return initial state', () => {
        const result = wikiRhsReducer(undefined, {type: 'UNKNOWN_ACTION'} as any);

        expect(result).toEqual(initialState);
    });

    describe('WikiRhsTypes.SET_MODE', () => {
        test('should set mode to outline', () => {
            const state = {...initialState, mode: 'comments' as const};
            const action = {type: WikiRhsTypes.SET_MODE, mode: 'outline' as const};

            const result = wikiRhsReducer(state, action as any);

            expect(result.mode).toBe('outline');
        });

        test('should set mode to comments', () => {
            const action = {type: WikiRhsTypes.SET_MODE, mode: 'comments' as const};

            const result = wikiRhsReducer(initialState, action as any);

            expect(result.mode).toBe('comments');
        });
    });

    describe('WikiRhsTypes.SET_WIKI_ID', () => {
        test('should set wikiId', () => {
            const action = {type: WikiRhsTypes.SET_WIKI_ID, wikiId: 'wiki123'};

            const result = wikiRhsReducer(initialState, action as any);

            expect(result.wikiId).toBe('wiki123');
        });

        test('should set wikiId to null', () => {
            const state = {...initialState, wikiId: 'wiki123'};
            const action = {type: WikiRhsTypes.SET_WIKI_ID, wikiId: null};

            const result = wikiRhsReducer(state, action as any);

            expect(result.wikiId).toBe(null);
        });
    });

    describe('WikiRhsTypes.SET_FOCUSED_INLINE_COMMENT_ID', () => {
        test('should set focusedInlineCommentId', () => {
            const action = {type: WikiRhsTypes.SET_FOCUSED_INLINE_COMMENT_ID, commentId: 'comment123'};

            const result = wikiRhsReducer(initialState, action as any);

            expect(result.focusedInlineCommentId).toBe('comment123');
        });

        test('should clear focusedInlineCommentId', () => {
            const state = {...initialState, focusedInlineCommentId: 'comment123'};
            const action = {type: WikiRhsTypes.SET_FOCUSED_INLINE_COMMENT_ID, commentId: null};

            const result = wikiRhsReducer(state, action as any);

            expect(result.focusedInlineCommentId).toBe(null);
        });
    });

    describe('WikiRhsTypes.SET_ACTIVE_TAB', () => {
        test('should set activeTab to page_comments', () => {
            const state = {...initialState, activeTab: 'all_threads' as const};
            const action = {type: WikiRhsTypes.SET_ACTIVE_TAB, tab: 'page_comments' as const};

            const result = wikiRhsReducer(state, action as any);

            expect(result.activeTab).toBe('page_comments');
        });

        test('should set activeTab to all_threads', () => {
            const action = {type: WikiRhsTypes.SET_ACTIVE_TAB, tab: 'all_threads' as const};

            const result = wikiRhsReducer(initialState, action as any);

            expect(result.activeTab).toBe('all_threads');
        });
    });

    describe('WikiRhsTypes.SET_PENDING_INLINE_ANCHOR', () => {
        test('should set pendingInlineAnchor', () => {
            const anchor = {anchor_id: 'anchor123', text: 'Selected text'};
            const action = {type: WikiRhsTypes.SET_PENDING_INLINE_ANCHOR, anchor};

            const result = wikiRhsReducer(initialState, action as any);

            expect(result.pendingInlineAnchor).toEqual(anchor);
        });

        test('should clear pendingInlineAnchor', () => {
            const state = {
                ...initialState,
                pendingInlineAnchor: {anchor_id: 'anchor123', text: 'Selected text'},
            };
            const action = {type: WikiRhsTypes.SET_PENDING_INLINE_ANCHOR, anchor: null};

            const result = wikiRhsReducer(state, action as any);

            expect(result.pendingInlineAnchor).toBe(null);
        });
    });

    describe('ActionTypes.UPDATE_RHS_STATE', () => {
        test('should set selectedPageId when state is wiki', () => {
            const action = {
                type: ActionTypes.UPDATE_RHS_STATE,
                state: 'wiki',
                pageId: 'page123',
            };

            const result = wikiRhsReducer(initialState, action as any);

            expect(result.selectedPageId).toBe('page123');
        });

        test('should set selectedPageId to empty when pageId not provided for wiki state', () => {
            const action = {
                type: ActionTypes.UPDATE_RHS_STATE,
                state: 'wiki',
            };

            const result = wikiRhsReducer(initialState, action as any);

            expect(result.selectedPageId).toBe('');
        });

        test('should clear selectedPageId when state is not wiki', () => {
            const state = {...initialState, selectedPageId: 'page123'};
            const action = {
                type: ActionTypes.UPDATE_RHS_STATE,
                state: 'channel',
            };

            const result = wikiRhsReducer(state, action as any);

            expect(result.selectedPageId).toBe('');
        });
    });

    describe('WikiRhsTypes.SET_SUBMITTING_COMMENT', () => {
        test('should set isSubmittingComment to true', () => {
            const action = {type: WikiRhsTypes.SET_SUBMITTING_COMMENT, isSubmitting: true};

            const result = wikiRhsReducer(initialState, action as any);

            expect(result.isSubmittingComment).toBe(true);
        });

        test('should set isSubmittingComment to false', () => {
            const state = {...initialState, isSubmittingComment: true};
            const action = {type: WikiRhsTypes.SET_SUBMITTING_COMMENT, isSubmitting: false};

            const result = wikiRhsReducer(state, action as any);

            expect(result.isSubmittingComment).toBe(false);
        });
    });

    describe('UserTypes.LOGOUT_SUCCESS', () => {
        test('should reset to initial state on logout', () => {
            const state: WikiRhsState = {
                mode: 'comments',
                wikiId: 'wiki123',
                selectedPageId: 'page123',
                focusedInlineCommentId: 'comment123',
                activeTab: 'all_threads',
                pendingInlineAnchor: null,
                isSubmittingComment: true,
            };

            const action = {type: UserTypes.LOGOUT_SUCCESS};

            const result = wikiRhsReducer(state, action as any);

            expect(result).toEqual(initialState);
        });
    });

    test('should not modify state for unknown action', () => {
        const state: WikiRhsState = {
            mode: 'comments',
            wikiId: 'wiki123',
            selectedPageId: 'page123',
            focusedInlineCommentId: 'comment123',
            activeTab: 'all_threads',
            pendingInlineAnchor: null,
            isSubmittingComment: false,
        };

        const result = wikiRhsReducer(state, {type: 'UNKNOWN_ACTION'} as any);

        expect(result).toBe(state);
    });
});
