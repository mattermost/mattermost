// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {makeInitialPagesState} from 'tests/helpers/pages_state';

import {isPageCommentResolved, getPageCommentResolutionInfo, makeGetFilteredPostIdsForWikiThread, makeGetFilteredCommentsByResolution} from './wiki_posts';

function makeState(pagesOverride: Partial<ReturnType<typeof makeInitialPagesState>> = {}): any {
    return {
        entities: {
            pages: {...makeInitialPagesState(), ...pagesOverride},
        },
    };
}

function mockPost(id: string, overrides: Partial<Post> = {}): Post {
    return {
        id,
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        user_id: 'user1',
        channel_id: 'channel1',
        root_id: '',
        original_id: '',
        page_parent_id: '',
        message: 'msg',
        type: 'page_comment' as any,
        props: {},
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {embeds: [], emojis: [], files: [], images: {}},
        ...overrides,
    };
}

describe('wiki_posts selectors', () => {
    describe('isPageCommentResolved', () => {
        it('should return false for comment without resolution props', () => {
            const comment: Post = {
                id: 'comment1',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                edit_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: 'page1',
                original_id: '',
                page_parent_id: '',
                message: 'Test comment',
                type: 'page_comment',
                props: {},
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                },
            } as Post;

            expect(isPageCommentResolved(comment)).toBe(false);
        });

        it('should return true for resolved comment', () => {
            const comment: Post = {
                id: 'comment1',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                edit_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: 'page1',
                original_id: '',
                page_parent_id: '',
                message: 'Test comment',
                type: 'page_comment',
                props: {
                    comment_resolved: true,
                    resolved_at: 1234567900,
                    resolved_by: 'user2',
                    resolution_reason: 'manual',
                },
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                },
            } as Post;

            expect(isPageCommentResolved(comment)).toBe(true);
        });

        it('should return false when comment_resolved is false', () => {
            const comment: Post = {
                id: 'comment1',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                edit_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: 'page1',
                original_id: '',
                page_parent_id: '',
                message: 'Test comment',
                type: 'page_comment',
                props: {
                    comment_resolved: false,
                },
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                },
            } as Post;

            expect(isPageCommentResolved(comment)).toBe(false);
        });
    });

    describe('getPageCommentResolutionInfo', () => {
        it('should return empty resolution info for unresolved comment', () => {
            const comment: Post = {
                id: 'comment1',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                edit_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: 'page1',
                original_id: '',
                page_parent_id: '',
                message: 'Test comment',
                type: 'page_comment',
                props: {},
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                },
            } as Post;

            const info = getPageCommentResolutionInfo(comment);
            expect(info.resolved).toBe(false);
            expect(info.resolvedAt).toBe(0);
            expect(info.resolvedBy).toBe('');
            expect(info.resolutionReason).toBe('');
        });

        it('should return full resolution info for resolved comment', () => {
            const comment: Post = {
                id: 'comment1',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                edit_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: 'page1',
                original_id: '',
                page_parent_id: '',
                message: 'Test comment',
                type: 'page_comment',
                props: {
                    comment_resolved: true,
                    resolved_at: 1234567900,
                    resolved_by: 'user2',
                    resolution_reason: 'manual',
                },
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                },
            } as Post;

            const info = getPageCommentResolutionInfo(comment);
            expect(info.resolved).toBe(true);
            expect(info.resolvedAt).toBe(1234567900);
            expect(info.resolvedBy).toBe('user2');
            expect(info.resolutionReason).toBe('manual');
        });

        it('should handle dangling resolution reason', () => {
            const comment: Post = {
                id: 'comment1',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                edit_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: 'page1',
                original_id: '',
                page_parent_id: '',
                message: 'Test comment',
                type: 'page_comment',
                props: {
                    comment_resolved: true,
                    resolved_at: 1234567900,
                    resolved_by: 'system',
                    resolution_reason: 'dangling',
                },
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                },
            } as Post;

            const info = getPageCommentResolutionInfo(comment);
            expect(info.resolutionReason).toBe('dangling');
        });

        it('should handle missing props gracefully', () => {
            const comment: Post = {
                id: 'comment1',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                edit_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: 'page1',
                original_id: '',
                page_parent_id: '',
                message: 'Test comment',
                type: 'page_comment',
                props: {},
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                },
            } as Post;

            const info = getPageCommentResolutionInfo(comment);
            expect(info.resolved).toBe(false);
            expect(info.resolvedAt).toBe(0);
            expect(info.resolvedBy).toBe('');
            expect(info.resolutionReason).toBe('');
        });
    });

    describe('makeGetFilteredPostIdsForWikiThread', () => {
        it('returns empty array when page has no comments', () => {
            const selector = makeGetFilteredPostIdsForWikiThread();
            const state = makeState();
            expect(selector(state, 'page1', null)).toEqual([]);
        });

        it('list mode: excludes inline comments and their replies', () => {
            const inline = mockPost('inline1', {
                props: {comment_type: 'inline', inline_anchor: {text: 'quoted text'}, page_id: 'page1'},
            });
            const inlineReply = mockPost('inlineReply1', {
                props: {parent_comment_id: 'inline1', page_id: 'page1'},
            });
            const pageLevelComment = mockPost('pageComment1', {props: {page_id: 'page1'}});

            const state = makeState({
                commentsById: {inline1: inline, inlineReply1: inlineReply, pageComment1: pageLevelComment},
                commentsByPageId: {page1: ['inline1', 'inlineReply1', 'pageComment1']},
            });

            const selector = makeGetFilteredPostIdsForWikiThread();
            const result = selector(state, 'page1', null);

            expect(result).toContain('pageComment1');
            expect(result).not.toContain('inline1');
            expect(result).not.toContain('inlineReply1');
        });

        it('focused mode: returns focused comment + its replies only', () => {
            const inline = mockPost('inline1', {
                props: {comment_type: 'inline', inline_anchor: {text: 'quoted'}, page_id: 'page1'},
            });
            const reply1 = mockPost('reply1', {
                props: {parent_comment_id: 'inline1', page_id: 'page1'},
            });
            const reply2 = mockPost('reply2', {
                props: {parent_comment_id: 'inline1', page_id: 'page1'},
            });
            const unrelatedComment = mockPost('other1', {props: {page_id: 'page1'}});

            const state = makeState({
                commentsById: {inline1: inline, reply1, reply2, other1: unrelatedComment},
                commentsByPageId: {page1: ['inline1', 'reply1', 'reply2', 'other1']},
            });

            const selector = makeGetFilteredPostIdsForWikiThread();
            const result = selector(state, 'page1', 'inline1');

            expect(result[0]).toBe('inline1');
            expect(result).toContain('reply1');
            expect(result).toContain('reply2');
            expect(result).not.toContain('other1');
        });

        it('focused mode: always starts with focused comment even if missing from store', () => {
            const state = makeState({
                commentsById: {},
                commentsByPageId: {page1: []},
            });
            const selector = makeGetFilteredPostIdsForWikiThread();
            const result = selector(state, 'page1', 'missing-comment');
            expect(result[0]).toBe('missing-comment');
        });

        it('list mode: returns ids in reverse order (newest first)', () => {
            const c1 = mockPost('c1', {props: {page_id: 'page1'}});
            const c2 = mockPost('c2', {props: {page_id: 'page1'}});
            const c3 = mockPost('c3', {props: {page_id: 'page1'}});

            const state = makeState({
                commentsById: {c1, c2, c3},
                commentsByPageId: {page1: ['c1', 'c2', 'c3']},
            });

            const selector = makeGetFilteredPostIdsForWikiThread();
            const result = selector(state, 'page1', null);

            expect(result).toEqual(['c3', 'c2', 'c1']);
        });
    });

    describe('makeGetFilteredCommentsByResolution', () => {
        it('returns only unresolved comments when showResolved=false', () => {
            const resolved = mockPost('c1', {
                props: {comment_resolved: true, resolved_at: 9999, page_id: 'page1'},
            });
            const open = mockPost('c2', {props: {page_id: 'page1'}});

            const state = makeState({
                commentsById: {c1: resolved, c2: open},
                commentsByPageId: {page1: ['c1', 'c2']},
            });

            const selector = makeGetFilteredCommentsByResolution();
            expect(selector(state, 'page1', false)).toEqual(['c2']);
        });

        it('returns only resolved comments when showResolved=true', () => {
            const resolved = mockPost('c1', {
                props: {comment_resolved: true, resolved_at: 9999, page_id: 'page1'},
            });
            const open = mockPost('c2', {props: {page_id: 'page1'}});

            const state = makeState({
                commentsById: {c1: resolved, c2: open},
                commentsByPageId: {page1: ['c1', 'c2']},
            });

            const selector = makeGetFilteredCommentsByResolution();
            expect(selector(state, 'page1', true)).toEqual(['c1']);
        });

        it('returns empty array when page has no comments', () => {
            const selector = makeGetFilteredCommentsByResolution();
            expect(selector(makeState(), 'page1', false)).toEqual([]);
        });

        it('skips comment ids not present in commentsById', () => {
            const state = makeState({
                commentsById: {},
                commentsByPageId: {page1: ['ghost']},
            });
            const selector = makeGetFilteredCommentsByResolution();
            expect(selector(state, 'page1', false)).toEqual([]);
        });
    });
});
