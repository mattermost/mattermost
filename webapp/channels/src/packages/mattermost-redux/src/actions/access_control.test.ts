// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import {
    getChannelActivityWarning,
} from './access_control';

jest.mock('mattermost-redux/client');

describe('Access Control Activity Warning Actions', () => {
    const mockDispatch = jest.fn();
    const mockGetState = jest.fn(() => ({
        entities: {
            users: {
                currentUserId: 'user123',
            },
        },
        errors: {},
        requests: {},
        websocket: {},
    })) as jest.MockedFunction<() => any>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset the mock state
        mockGetState.mockReturnValue({
            entities: {
                users: {
                    currentUserId: 'user123',
                },
            },
            errors: {},
            requests: {},
            websocket: {},
        });
    });

    describe('getChannelActivityWarning', () => {
        it('should return data on successful API call', async () => {
            const policyId = 'policy123';
            const mockResponse = {
                should_show_warning: true,
            };

            (Client4.getChannelActivityWarning as jest.Mock).mockResolvedValue(mockResponse);

            const action = getChannelActivityWarning(policyId);
            const result = await action(mockDispatch, mockGetState, undefined);

            expect(Client4.getChannelActivityWarning).toHaveBeenCalledWith(policyId);
            expect(result).toEqual({data: mockResponse});
        });

        it('should return error on API failure', async () => {
            const policyId = 'policy123';
            const mockError = new Error('Network error');

            (Client4.getChannelActivityWarning as jest.Mock).mockRejectedValue(mockError);

            const action = getChannelActivityWarning(policyId);
            const result = await action(mockDispatch, mockGetState, undefined);

            expect(Client4.getChannelActivityWarning).toHaveBeenCalledWith(policyId);
            expect(result).toEqual({error: mockError});
        });

        it('should return data when no warning should be shown', async () => {
            const policyId = 'policy123';
            const mockResponse = {
                should_show_warning: false,
            };

            (Client4.getChannelActivityWarning as jest.Mock).mockResolvedValue(mockResponse);

            const action = getChannelActivityWarning(policyId);
            const result = await action(mockDispatch, mockGetState, undefined);

            expect(result).toEqual({data: mockResponse});
        });
    });
});
