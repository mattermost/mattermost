// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import * as Actions from './burn_on_read_deletion';

jest.mock('mattermost-redux/client');

describe('burn_on_read_deletion actions', () => {
    let mockDispatch: jest.Mock;

    beforeEach(() => {
        mockDispatch = jest.fn();
        jest.clearAllMocks();
    });

    describe('burnPostNow', () => {
        it('should call API and dispatch POST_REMOVED on success', async () => {
            (Client4.burnPostNow as jest.Mock).mockResolvedValue({});

            const mockPost = {
                id: 'post123',
                user_id: 'user1',
                channel_id: 'channel1',
            };

            const mockGetState = () => ({
                entities: {
                    users: {
                        currentUserId: 'user123',
                    },
                    posts: {
                        posts: {
                            post123: mockPost,
                        },
                    },
                },
            } as any);

            const action = Actions.burnPostNow('post123');
            const result = await action(mockDispatch, mockGetState, undefined);

            expect(Client4.burnPostNow).toHaveBeenCalledWith('post123');
            expect(mockDispatch).toHaveBeenCalledWith({
                type: PostTypes.POST_REMOVED,
                data: mockPost,
            });
            expect(result.data).toBe(true);
        });

        it('should return error and not dispatch POST_REMOVED when API call fails', async () => {
            const error = new Error('API Error');
            (Client4.burnPostNow as jest.Mock).mockRejectedValue(error);

            const mockPost = {
                id: 'post123',
                user_id: 'user1',
                channel_id: 'channel1',
            };

            const mockGetState = () => ({
                entities: {
                    users: {
                        currentUserId: 'user123',
                    },
                    posts: {
                        posts: {
                            post123: mockPost,
                        },
                    },
                },
            } as any);

            const action = Actions.burnPostNow('post123');
            const result = await action(mockDispatch, mockGetState, undefined);

            expect(result.error).toBe(error);
            expect(mockDispatch).not.toHaveBeenCalledWith({
                type: PostTypes.POST_REMOVED,
                data: mockPost,
            });
        });
    });

    describe('handlePostExpired', () => {
        it('should dispatch POST_REMOVED action with full post object', async () => {
            const mockPost = {
                id: 'post123',
                channel_id: 'channel1',
                user_id: 'user1',
                message: 'test',
                create_at: 123456,
            };

            const mockGetState = () => ({
                entities: {
                    posts: {
                        posts: {
                            post123: mockPost,
                        },
                    },
                },
            } as any);

            const action = Actions.handlePostExpired('post123');
            const result = await action(mockDispatch, mockGetState, undefined);

            expect(mockDispatch).toHaveBeenCalledWith({
                type: PostTypes.POST_REMOVED,
                data: mockPost,
            });
            expect(result.data).toBe(true);
        });

        it('should return early if post does not exist', async () => {
            const mockGetState = () => ({
                entities: {
                    posts: {
                        posts: {},
                    },
                },
            } as any);

            const action = Actions.handlePostExpired('nonexistent');
            const result = await action(mockDispatch, mockGetState, undefined);

            expect(mockDispatch).not.toHaveBeenCalled();
            expect(result.data).toBe(true);
        });
    });
});
