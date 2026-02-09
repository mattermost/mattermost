// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {PostPriority} from '@mattermost/types/posts';

import FailedPostOptions from 'components/post_view/failed_post_options/failed_post_options';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('FailedPostOptions - encrypted post retry', () => {
    test('should re-encrypt on retry for encrypted posts', async () => {
        const encryptedPost = TestHelper.getPostMock({
            message: 'plaintext message from redux',
            metadata: {
                priority: {
                    priority: PostPriority.ENCRYPTED,
                },
            } as any,
        });

        const encryptedResult = TestHelper.getPostMock({
            message: 'PENC:v1:encrypted_content',
            metadata: encryptedPost.metadata,
        });

        const mockRunHooks = jest.fn().mockResolvedValue({data: encryptedResult});
        const mockCreatePost = jest.fn();

        const props = {
            post: encryptedPost,
            actions: {
                createPost: mockCreatePost,
                removePost: jest.fn(),
                runMessageWillBePostedHooks: mockRunHooks,
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const retryLink = screen.getByText('Retry');
        await userEvent.click(retryLink);

        // Should run hooks to re-encrypt
        expect(mockRunHooks).toHaveBeenCalledTimes(1);
        const hookArg = mockRunHooks.mock.calls[0][0];
        expect(hookArg.message).toBe('plaintext message from redux');

        // Should create post with re-encrypted message
        expect(mockCreatePost).toHaveBeenCalledTimes(1);
        expect(mockCreatePost.mock.calls[0][0].message).toBe('PENC:v1:encrypted_content');
    });

    test('should not call createPost if hooks fail for encrypted retry', async () => {
        const encryptedPost = TestHelper.getPostMock({
            message: 'plaintext message',
            metadata: {
                priority: {
                    priority: PostPriority.ENCRYPTED,
                },
            } as any,
        });

        const mockRunHooks = jest.fn().mockResolvedValue({error: {message: 'encryption failed'}});
        const mockCreatePost = jest.fn();

        const props = {
            post: encryptedPost,
            actions: {
                createPost: mockCreatePost,
                removePost: jest.fn(),
                runMessageWillBePostedHooks: mockRunHooks,
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const retryLink = screen.getByText('Retry');
        await userEvent.click(retryLink);

        expect(mockRunHooks).toHaveBeenCalledTimes(1);
        expect(mockCreatePost).not.toHaveBeenCalled();
    });

    test('should not run hooks for non-encrypted posts on retry', async () => {
        const normalPost = TestHelper.getPostMock({
            message: 'normal message',
        });

        const mockRunHooks = jest.fn();
        const mockCreatePost = jest.fn();

        const props = {
            post: normalPost,
            actions: {
                createPost: mockCreatePost,
                removePost: jest.fn(),
                runMessageWillBePostedHooks: mockRunHooks,
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const retryLink = screen.getByText('Retry');
        await userEvent.click(retryLink);

        // Should NOT run hooks for non-encrypted posts
        expect(mockRunHooks).not.toHaveBeenCalled();
        expect(mockCreatePost).toHaveBeenCalledTimes(1);
    });

    test('should fall back to direct createPost if hooks not provided', async () => {
        const encryptedPost = TestHelper.getPostMock({
            message: 'plaintext message',
            metadata: {
                priority: {
                    priority: PostPriority.ENCRYPTED,
                },
            } as any,
        });

        const mockCreatePost = jest.fn();

        const props = {
            post: encryptedPost,
            actions: {
                createPost: mockCreatePost,
                removePost: jest.fn(),
                // runMessageWillBePostedHooks not provided (backwards compat)
            },
        };

        renderWithContext(<FailedPostOptions {...props}/>);

        const retryLink = screen.getByText('Retry');
        await userEvent.click(retryLink);

        // Without hooks, should fall back to direct createPost
        expect(mockCreatePost).toHaveBeenCalledTimes(1);
    });
});
