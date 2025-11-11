// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {isPageCommentResolved, getPageCommentResolutionInfo} from './wiki_posts';

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
});
