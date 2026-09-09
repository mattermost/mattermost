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

    const renderRow = () => renderWithContext(
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

    test('denies a request through the confirmation modal', async () => {
        mockPatchChannelJoinRequest.mockReturnValue({
            type: 'MOCK_PATCH_CHANNEL_JOIN_REQUEST',
            data: {...baseRequest, status: 'denied'},
        });

        renderRow();

        await userEvent.click(screen.getByRole('button', {name: 'Deny'}));
        await userEvent.click(await screen.findByText('Deny request'));

        await waitFor(() => {
            expect(mockPatchChannelJoinRequest).toHaveBeenCalledWith('channel1', 'request1', {status: 'denied'});
        });
    });

    test('closes the deny modal and surfaces the inline error when denial fails', async () => {
        mockPatchChannelJoinRequest.mockReturnValue({
            type: 'MOCK_PATCH_CHANNEL_JOIN_REQUEST',
            error: {server_error_id: 'api.channel.discoverable_join_request.not_pending.app_error', message: 'stale'},
        });

        renderRow();

        await userEvent.click(screen.getByRole('button', {name: 'Deny'}));
        await userEvent.click(await screen.findByText('Deny request'));

        // The row error is visible (modal closed) and the queue is refreshed
        // because a not_pending error means the list is stale.
        expect(await screen.findByRole('alert')).toHaveTextContent('This request is no longer pending.');
        await waitFor(() => {
            expect(mockGetChannelJoinRequests).toHaveBeenCalledWith('channel1', {status: 'pending'});
        });
        expect(screen.queryByText('Deny request')).not.toBeInTheDocument();
    });

    test('maps the feature_disabled error without refreshing the queue on approve', async () => {
        mockPatchChannelJoinRequest.mockReturnValue({
            type: 'MOCK_PATCH_CHANNEL_JOIN_REQUEST',
            error: {server_error_id: 'api.channel.discoverable_join_request.feature_disabled.app_error', message: 'off'},
        });

        renderRow();

        await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

        expect(await screen.findByRole('alert')).toHaveTextContent('Discoverable channels are not enabled on this server.');
        expect(mockGetChannelJoinRequests).not.toHaveBeenCalled();
    });
});
