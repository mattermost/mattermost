// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserThreadWithPost} from '@mattermost/types/threads';

import {PostTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import {fetchMissingPagePosts} from './page_threads';

// Mock Client4.getPost
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getPost: jest.fn(),
    },
}));

const mockGetPost = Client4.getPost as jest.MockedFunction<typeof Client4.getPost>;

describe('mattermost-redux/actions/page_threads', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchMissingPagePosts', () => {
        const createThread = (postId: string, type: string, pageId?: string): UserThreadWithPost => ({
            id: `thread_${postId}`,
            reply_count: 0,
            last_reply_at: 0,
            last_viewed_at: 0,
            participants: [],
            post: {
                id: postId,
                type: type as any,
                props: pageId ? {page_id: pageId} : {},
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                edit_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: '',
                original_id: '',
                message: '',
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {embeds: [], emojis: [], files: [], images: {}},
            },
            is_following: true,
            unread_replies: 0,
            unread_mentions: 0,
        });

        test('should fetch missing page posts for page_comment threads', async () => {
            const threads: UserThreadWithPost[] = [
                createThread('comment1', 'page_comment', 'page1'),
                createThread('comment2', 'page_comment', 'page2'),
            ];

            const page1 = {id: 'page1', type: 'page', message: 'Page 1 content'};
            const page2 = {id: 'page2', type: 'page', message: 'Page 2 content'};

            mockGetPost.mockImplementation((pageId: string) => {
                if (pageId === 'page1') {
                    return Promise.resolve(page1 as any);
                }
                if (pageId === 'page2') {
                    return Promise.resolve(page2 as any);
                }
                return Promise.reject(new Error('Not found'));
            });

            const dispatch = jest.fn();

            await fetchMissingPagePosts(threads, dispatch);

            expect(dispatch).toHaveBeenCalledWith({
                type: PostTypes.RECEIVED_POSTS,
                data: {
                    posts: [
                        {...page1, update_at: 0},
                        {...page2, update_at: 0},
                    ],
                },
            });
        });

        test('should not dispatch when no page_comment threads', async () => {
            const threads: UserThreadWithPost[] = [
                createThread('post1', 'message'),
                createThread('post2', 'system_add_to_channel'),
            ];

            const dispatch = jest.fn();

            await fetchMissingPagePosts(threads, dispatch);

            expect(dispatch).not.toHaveBeenCalled();
            expect(mockGetPost).not.toHaveBeenCalled();
        });

        test('should deduplicate page IDs', async () => {
            const threads: UserThreadWithPost[] = [
                createThread('comment1', 'page_comment', 'page1'),
                createThread('comment2', 'page_comment', 'page1'), // Same page
                createThread('comment3', 'page_comment', 'page1'), // Same page again
            ];

            const page1 = {id: 'page1', type: 'page', message: 'Page content'};
            mockGetPost.mockResolvedValue(page1 as any);

            const dispatch = jest.fn();

            await fetchMissingPagePosts(threads, dispatch);

            // Should only fetch once due to deduplication
            expect(mockGetPost).toHaveBeenCalledTimes(1);
            expect(dispatch).toHaveBeenCalledTimes(1);
        });

        test('should handle page_comment threads without page_id', async () => {
            const threads: UserThreadWithPost[] = [
                createThread('comment1', 'page_comment'), // No page_id
            ];

            const dispatch = jest.fn();

            await fetchMissingPagePosts(threads, dispatch);

            // Should not dispatch since no valid page_ids
            expect(dispatch).not.toHaveBeenCalled();
            expect(mockGetPost).not.toHaveBeenCalled();
        });

        test('should handle fetch errors gracefully', async () => {
            const threads: UserThreadWithPost[] = [
                createThread('comment1', 'page_comment', 'page1'),
            ];

            mockGetPost.mockRejectedValue(new Error('Not found'));

            const dispatch = jest.fn();

            // Should not throw
            await expect(fetchMissingPagePosts(threads, dispatch)).resolves.not.toThrow();

            // Should not dispatch on error
            expect(dispatch).not.toHaveBeenCalled();
        });

        test('should set update_at to 0 for fetched posts', async () => {
            const threads: UserThreadWithPost[] = [
                createThread('comment1', 'page_comment', 'page1'),
            ];

            const page1 = {
                id: 'page1',
                type: 'page',
                message: 'Content',
                update_at: 1234567890,
            };

            mockGetPost.mockResolvedValue(page1 as any);

            const dispatch = jest.fn();

            await fetchMissingPagePosts(threads, dispatch);

            expect(dispatch).toHaveBeenCalledWith({
                type: PostTypes.RECEIVED_POSTS,
                data: {
                    posts: [{...page1, update_at: 0}],
                },
            });
        });
    });
});
