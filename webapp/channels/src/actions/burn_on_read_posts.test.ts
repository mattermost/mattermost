// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {Posts} from 'mattermost-redux/constants';

import {revealBurnOnReadPost} from './burn_on_read_posts';

jest.mock('mattermost-redux/client');

describe('burn_on_read_posts actions', () => {
    const mockPost = {
        id: 'post123',
        type: Posts.POST_TYPES.BURN_ON_READ,
        user_id: 'user1',
        channel_id: 'channel1',
        message: 'revealed content',
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        metadata: {
            expire_at: 9999999999999,
        },
    };

    const mockResponse = {
        ...mockPost,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('revealBurnOnReadPost', () => {
        const mockState = {
            entities: {
                users: {
                    currentUserId: 'user1',
                },
            },
        };

        it('should dispatch success action on successful reveal', async () => {
            (Client4.revealBurnOnReadPost as jest.Mock) = jest.fn().mockResolvedValue(mockResponse);

            const dispatch = jest.fn();
            const getState = jest.fn().mockReturnValue(mockState);

            const result = await revealBurnOnReadPost('post123')(dispatch, getState, undefined);

            expect(Client4.revealBurnOnReadPost).toHaveBeenCalledWith('post123');

            expect(dispatch).toHaveBeenCalledWith({
                type: PostTypes.REVEAL_BURN_ON_READ_SUCCESS,
                data: {
                    post: mockResponse,
                    expireAt: 9999999999999,
                },
            });

            expect(result).toEqual({data: mockResponse});
        });

        it('should return error on failure', async () => {
            const mockError = {
                message: 'Not found',
                status_code: 404,
            };

            (Client4.revealBurnOnReadPost as jest.Mock) = jest.fn().mockRejectedValue(mockError);

            const dispatch = jest.fn();
            const getState = jest.fn().mockReturnValue(mockState);

            const result = await revealBurnOnReadPost('post123')(dispatch, getState, undefined);

            // Should dispatch logError thunk (which is a function, not a plain action)
            expect(dispatch).toHaveBeenCalledWith(expect.any(Function));

            expect(result).toEqual({error: mockError});
        });

        it('should handle network errors', async () => {
            const networkError = new Error('Network error');

            (Client4.revealBurnOnReadPost as jest.Mock) = jest.fn().mockRejectedValue(networkError);

            const dispatch = jest.fn();
            const getState = jest.fn().mockReturnValue(mockState);

            const result = await revealBurnOnReadPost('post123')(dispatch, getState, undefined);

            expect(result.error).toBe(networkError);
        });
    });
});
