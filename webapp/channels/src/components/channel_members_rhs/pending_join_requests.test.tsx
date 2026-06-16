// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelJoinRequest} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PendingJoinRequests from './pending_join_requests';

const mockPatchChannelJoinRequest = jest.fn();
const mockGetChannelJoinRequests = jest.fn();
const mockCountPendingChannelJoinRequests = jest.fn();

jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannelJoinRequest: (...args: unknown[]) => mockPatchChannelJoinRequest(...args),
    getChannelJoinRequests: (...args: unknown[]) => mockGetChannelJoinRequests(...args),
    countPendingChannelJoinRequests: (...args: unknown[]) => mockCountPendingChannelJoinRequests(...args),
}));

jest.mock('actions/user_actions', () => ({
    loadProfilesAndReloadChannelMembers: jest.fn(() => ({type: 'MOCK_RELOAD_MEMBERS'})),
}));

const baseRequest: ChannelJoinRequest = {
    id: 'request1',
    channel_id: 'channel1',
    user_id: 'user1',
    message: '',
    status: 'pending',
    denial_reason: '',
    create_at: Date.now(),
    update_at: Date.now(),
    reviewed_by: '',
    reviewed_at: 0,
};

const baseUser = TestHelper.getUserMock({
    id: 'user1',
    username: 'requester',
    email: 'requester@test.com',
    first_name: 'Request',
    last_name: 'User',
    locale: 'en',
});

describe('PendingJoinRequests', () => {
    beforeEach(() => {
        mockPatchChannelJoinRequest.mockReset();
        mockGetChannelJoinRequests.mockReset();
        mockCountPendingChannelJoinRequests.mockReset();

        mockPatchChannelJoinRequest.mockReturnValue({
            type: 'MOCK_PATCH_CHANNEL_JOIN_REQUEST',
            data: {...baseRequest, status: 'approved'},
        });
        mockGetChannelJoinRequests.mockReturnValue({type: 'MOCK_GET_CHANNEL_JOIN_REQUESTS'});
        mockCountPendingChannelJoinRequests.mockReturnValue({type: 'MOCK_COUNT_PENDING'});
    });

    test('renders pending requests with approve action', async () => {
        renderWithContext(
            <PendingJoinRequests
                channelId='channel1'
                requests={[baseRequest]}
            />,
            {
                entities: {
                    users: {
                        profiles: {
                            user1: baseUser,
                        },
                    },
                },
            },
        );

        expect(screen.getByTestId('pending-join-requests-section')).toBeInTheDocument();
        expect(screen.getByTestId('pending-join-request-request1')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

        await waitFor(() => {
            expect(mockPatchChannelJoinRequest).toHaveBeenCalledWith('channel1', 'request1', {status: 'approved'});
        });
    });

    test('returns null when there are no pending requests', () => {
        const {container} = renderWithContext(
            <PendingJoinRequests
                channelId='channel1'
                requests={[]}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
