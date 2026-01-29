// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiRhsTypes} from 'utils/constants';

import {
    setWikiRhsMode,
    setWikiRhsWikiId,
    setWikiRhsActiveTab,
    setFocusedInlineCommentId,
} from './wiki_rhs';

describe('wiki_rhs actions', () => {
    describe('setWikiRhsMode', () => {
        test('should create action with outline mode', () => {
            const action = setWikiRhsMode('outline');

            expect(action).toEqual({
                type: WikiRhsTypes.SET_MODE,
                mode: 'outline',
            });
        });

        test('should create action with comments mode', () => {
            const action = setWikiRhsMode('comments');

            expect(action).toEqual({
                type: WikiRhsTypes.SET_MODE,
                mode: 'comments',
            });
        });
    });

    describe('setWikiRhsWikiId', () => {
        test('should create action with wikiId', () => {
            const action = setWikiRhsWikiId('wiki123');

            expect(action).toEqual({
                type: WikiRhsTypes.SET_WIKI_ID,
                wikiId: 'wiki123',
            });
        });

        test('should create action with null wikiId', () => {
            const action = setWikiRhsWikiId(null);

            expect(action).toEqual({
                type: WikiRhsTypes.SET_WIKI_ID,
                wikiId: null,
            });
        });
    });

    describe('setWikiRhsActiveTab', () => {
        test('should create action with page_comments tab', () => {
            const action = setWikiRhsActiveTab('page_comments');

            expect(action).toEqual({
                type: WikiRhsTypes.SET_ACTIVE_TAB,
                tab: 'page_comments',
            });
        });

        test('should create action with all_threads tab', () => {
            const action = setWikiRhsActiveTab('all_threads');

            expect(action).toEqual({
                type: WikiRhsTypes.SET_ACTIVE_TAB,
                tab: 'all_threads',
            });
        });
    });

    describe('setFocusedInlineCommentId', () => {
        test('should create action with commentId', () => {
            const action = setFocusedInlineCommentId('comment123');

            expect(action).toEqual({
                type: WikiRhsTypes.SET_FOCUSED_INLINE_COMMENT_ID,
                commentId: 'comment123',
            });
        });

        test('should create action with null commentId', () => {
            const action = setFocusedInlineCommentId(null);

            expect(action).toEqual({
                type: WikiRhsTypes.SET_FOCUSED_INLINE_COMMENT_ID,
                commentId: null,
            });
        });
    });
});
