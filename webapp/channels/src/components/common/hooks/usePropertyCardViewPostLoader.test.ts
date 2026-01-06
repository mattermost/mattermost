// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {usePropertyCardViewPostLoader} from './usePropertyCardViewPostLoader';

describe('usePropertyCardViewPostLoader', () => {
    const post1 = TestHelper.getPostMock({id: 'post1', delete_at: 0});
    const deletedPost = TestHelper.getPostMock({id: 'post2', delete_at: 123456789});
    const post2 = TestHelper.getPostMock({id: 'post3', delete_at: 0});

    describe('with store post loading', () => {
        test('should return the post from store when available and not deleted', async () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewPostLoader('post1', undefined, false),
                {
                    entities: {
                        posts: {
                            posts: {
                                post1,
                            },
                        },
                    },
                },
            );

            await waitFor(() => {
                expect(result.current).toBe(post1);
            });
        });

        test('should return undefined when post not in store and no getPost provided', () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewPostLoader('post1'),
            );

            expect(result.current).toBe(undefined);
        });

        test('should return deleted post from store', async () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewPostLoader('post2', undefined, false),
                {
                    entities: {
                        posts: {
                            posts: {
                                post2: deletedPost,
                            },
                        },
                    },
                },
            );

            await waitFor(() => {
                expect(result.current).toBe(deletedPost);
            });
        });
    });

    describe('with custom getPost function', () => {
        test('should use getPost when provided and post not in store', async () => {
            const getPostMock = jest.fn().mockResolvedValue(post1);

            const {result} = renderHookWithContext(
                () => usePropertyCardViewPostLoader('post1', getPostMock),
            );

            expect(result.current).toBe(undefined);
            expect(getPostMock).toHaveBeenCalledWith('post1');

            await waitFor(() => {
                expect(result.current).toBe(post1);
            });
        });

        test('should prefer store post over getPost when both available and post not deleted', async () => {
            const mockedPost1 = TestHelper.getPostMock({id: 'post1', delete_at: 0, message: 'Mocked post1'});
            const getPostMock = jest.fn().mockResolvedValue(mockedPost1);

            const {result} = renderHookWithContext(
                () => usePropertyCardViewPostLoader('post1', getPostMock),
                {
                    entities: {
                        posts: {
                            posts: {
                                post1,
                            },
                        },
                    },
                },
            );

            await waitFor(() => {
                expect(result.current).toBe(mockedPost1);
            });
            expect(getPostMock).toHaveBeenCalledTimes(1);
        });

        test('should handle getPost errors gracefully', async () => {
            const getPostMock = jest.fn().mockRejectedValue(new Error('Network error'));
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const {result} = renderHookWithContext(
                () => usePropertyCardViewPostLoader('post1', getPostMock),
            );

            expect(result.current).toBe(undefined);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    'Error occurred while fetching post for post preview property renderer',
                    expect.any(Error),
                );
            });

            expect(result.current).toBe(undefined);
            consoleSpy.mockRestore();
        });

        test('should only call getPost once per postId', async () => {
            const getPostMock = jest.fn().mockResolvedValue(post1);

            const {result, rerender} = renderHookWithContext(
                () => usePropertyCardViewPostLoader('post1', getPostMock),
            );

            expect(getPostMock).toHaveBeenCalledTimes(1);

            await waitFor(() => {
                expect(result.current).toBe(post1);
            });

            // Rerender multiple times
            for (let i = 0; i < 5; i++) {
                rerender();
            }

            expect(getPostMock).toHaveBeenCalledTimes(1);
        });

        test('should call getPost again when postId changes', async () => {
            const getPostMock = jest.fn().
                mockResolvedValueOnce(post1).
                mockResolvedValueOnce(post2);

            let postId = 'post1';
            const {result, rerender} = renderHookWithContext(
                () => usePropertyCardViewPostLoader(postId, getPostMock),
            );

            expect(getPostMock).toHaveBeenCalledWith('post1');

            await waitFor(() => {
                expect(result.current).toBe(post1);
            });

            // Change postId
            postId = 'post3';
            rerender();

            expect(getPostMock).toHaveBeenCalledWith('post3');

            await waitFor(() => {
                expect(result.current).toBe(post2);
            });

            expect(getPostMock).toHaveBeenCalledTimes(2);
        });
    });
});
