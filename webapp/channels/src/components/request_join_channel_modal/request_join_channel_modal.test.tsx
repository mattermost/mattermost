// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import RequestJoinChannelModal from './request_join_channel_modal';

const mockRequestJoinChannel = jest.fn();
const mockWithdrawMyChannelJoinRequest = jest.fn();
jest.mock('mattermost-redux/actions/channels', () => ({
    requestJoinChannel: (...args: unknown[]) => mockRequestJoinChannel(...args),
    withdrawMyChannelJoinRequest: (...args: unknown[]) => mockWithdrawMyChannelJoinRequest(...args),
}));

describe('RequestJoinChannelModal', () => {
    beforeEach(() => {
        mockRequestJoinChannel.mockReset();
        mockWithdrawMyChannelJoinRequest.mockReset();

        mockRequestJoinChannel.mockReturnValue({type: 'MOCK', data: {id: 'req1', channel_id: 'c1', user_id: 'u1', message: '', status: 'pending', denial_reason: '', create_at: 1, update_at: 1, reviewed_by: '', reviewed_at: 0}});
        mockWithdrawMyChannelJoinRequest.mockReturnValue({type: 'MOCK', data: {}});
    });

    const baseChannel = TestHelper.getChannelMock({
        id: 'discoverable-channel-id',
        team_id: 'team_1',
        display_name: 'Ops Channel',
        name: 'ops-channel',
        type: 'P',
        discoverable: true,
        purpose: 'For ops planning conversations',
        header: 'pinned: https://internal.example/ops-dashboard',
    });

    const baseState: DeepPartial<GlobalState> = {
        entities: {
            channels: {
                joinRequests: {
                    myPendingByChannel: {},
                    byChannel: {},
                    countsByChannel: {},
                    myList: [],
                },
            },
        },
    };

    test('renders as a stacked modal above an existing parent modal', async () => {
        const parentBackdrop = document.createElement('div');
        parentBackdrop.className = 'modal-backdrop';
        parentBackdrop.style.opacity = '0.5';
        document.body.appendChild(parentBackdrop);

        renderWithContext(
            <RequestJoinChannelModal
                channel={baseChannel}
                teamName='team_1'
            />,
            baseState,
        );

        await screen.findByTestId('request-join-channel-modal');

        const stackedBackdrop = document.querySelectorAll('.modal-backdrop');
        expect(stackedBackdrop.length).toBeGreaterThanOrEqual(2);
        expect(parentBackdrop.style.opacity).toBe('0');

        parentBackdrop.remove();
        document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
    });

    test('renders the simplified step-1 body and header channel name', async () => {
        renderWithContext(
            <RequestJoinChannelModal
                channel={baseChannel}
                teamName='team_1'
            />,
            baseState,
        );

        expect(await screen.findByText('Request to join channel')).toBeInTheDocument();
        expect(screen.getByText('Ops Channel')).toBeInTheDocument();
        expect(screen.getByText(/A channel admin will review your request/)).toBeInTheDocument();
        expect(screen.getByText(/My pending requests/)).toBeInTheDocument();
        expect(screen.queryByText(/direct message/i)).not.toBeInTheDocument();
        expect(screen.queryByTestId('request-join-channel-message')).not.toBeInTheDocument();
        expect(screen.queryByText(/Discoverable private channel/)).not.toBeInTheDocument();
        expect(screen.queryByText(/For ops planning conversations/)).not.toBeInTheDocument();
    });

    test('does NOT render the channel header (C-9 spillage mitigation)', async () => {
        renderWithContext(
            <RequestJoinChannelModal
                channel={baseChannel}
                teamName='team_1'
            />,
            baseState,
        );

        await screen.findByText('Ops Channel');

        expect(screen.queryByText(/internal.example/)).not.toBeInTheDocument();
        expect(screen.queryByText(/pinned/)).not.toBeInTheDocument();
    });

    test('Send Request calls requestJoinChannel with an empty message', async () => {
        renderWithContext(
            <RequestJoinChannelModal
                channel={baseChannel}
                teamName='team_1'
            />,
            baseState,
        );

        await userEvent.click(screen.getByText('Send Request'));

        expect(mockRequestJoinChannel).toHaveBeenCalledWith('discoverable-channel-id', '');
    });

    test('switches to the pending treatment when an existing request is in the store', async () => {
        const pendingState: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    joinRequests: {
                        myPendingByChannel: {
                            'discoverable-channel-id': {
                                id: 'req1',
                                channel_id: 'discoverable-channel-id',
                                user_id: 'u1',
                                message: 'opt-in note',
                                status: 'pending',
                                denial_reason: '',
                                create_at: 1,
                                update_at: 1,
                                reviewed_by: '',
                                reviewed_at: 0,
                            },
                        },
                        byChannel: {},
                        countsByChannel: {},
                        myList: [],
                    },
                },
            },
        };

        renderWithContext(
            <RequestJoinChannelModal
                channel={baseChannel}
                teamName='team_1'
            />,
            pendingState,
        );

        expect(await screen.findByText(/Your request to join Ops Channel has been sent/)).toBeInTheDocument();
        expect(screen.getByText(/My pending requests/)).toBeInTheDocument();
        expect(screen.queryByText(/direct message/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/opt-in note/)).not.toBeInTheDocument();
        expect(screen.getByText('Withdraw request')).toBeInTheDocument();
        expect(screen.queryByText('Send Request')).not.toBeInTheDocument();
    });

    test('Withdraw button calls withdrawMyChannelJoinRequest', async () => {
        const pendingState: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    joinRequests: {
                        myPendingByChannel: {
                            'discoverable-channel-id': {
                                id: 'req1',
                                channel_id: 'discoverable-channel-id',
                                user_id: 'u1',
                                message: '',
                                status: 'pending',
                                denial_reason: '',
                                create_at: 1,
                                update_at: 1,
                                reviewed_by: '',
                                reviewed_at: 0,
                            },
                        },
                        byChannel: {},
                        countsByChannel: {},
                        myList: [],
                    },
                },
            },
        };

        renderWithContext(
            <RequestJoinChannelModal
                channel={baseChannel}
                teamName='team_1'
            />,
            pendingState,
        );

        await screen.findByText('Withdraw request');

        await userEvent.click(screen.getByText('Withdraw request'));

        expect(mockWithdrawMyChannelJoinRequest).toHaveBeenCalledWith('discoverable-channel-id');
    });

    test('renders a friendly error when the server returns policy_denied', async () => {
        mockRequestJoinChannel.mockReturnValueOnce({
            type: 'MOCK',
            error: {
                message: 'raw server message',
                server_error_id: 'api.channel.discoverable_join_request.policy_denied.app_error',
            },
        });

        renderWithContext(
            <RequestJoinChannelModal
                channel={baseChannel}
                teamName='team_1'
            />,
            baseState,
        );

        await screen.findByText('Send Request');

        await userEvent.click(screen.getByText('Send Request'));

        await waitFor(() => {
            expect(screen.getByText(/You don't match this channel's Membership Policy/)).toBeInTheDocument();
        });
    });
});
