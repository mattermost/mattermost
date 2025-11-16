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

            const action = Actions.burnPostNow('post123');
            const result = await action(mockDispatch, () => ({} as any), undefined);

            expect(Client4.burnPostNow).toHaveBeenCalledWith('post123');
            expect(mockDispatch).toHaveBeenCalledWith({
                type: PostTypes.POST_REMOVED,
                data: {id: 'post123'},
            });
            expect(result.data).toBe(true);
        });

        it('should return error and not dispatch POST_REMOVED when API call fails', async () => {
            const error = new Error('API Error');
            (Client4.burnPostNow as jest.Mock).mockRejectedValue(error);

            const mockGetState = () => ({
                entities: {
                    users: {
                        currentUserId: 'user123',
                    },
                },
            } as any);

            const action = Actions.burnPostNow('post123');
            const result = await action(mockDispatch, mockGetState, undefined);

            expect(result.error).toBe(error);
            expect(mockDispatch).not.toHaveBeenCalledWith({
                type: PostTypes.POST_REMOVED,
                data: {id: 'post123'},
            });
        });
    });

    describe('handlePostExpired', () => {
        it('should dispatch POST_REMOVED action', async () => {
            const action = Actions.handlePostExpired('post123');
            const result = await action(mockDispatch, () => ({} as any), undefined);

            expect(mockDispatch).toHaveBeenCalledWith({
                type: PostTypes.POST_REMOVED,
                data: {id: 'post123'},
            });
            expect(result.data).toBe(true);
        });
    });
});
