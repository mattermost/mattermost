// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelJoinRequest} from '@mattermost/types/channels';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RequestJoinChannelModal from './request_join_channel_modal';

function buildChannel(overrides: Partial<Channel> = {}): Channel {
    return {
        id: 'channel1',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        team_id: 'team1',
        type: 'P',
        display_name: 'Private channel',
        name: 'private-channel',
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        creator_id: 'user1',
        scheme_id: '',
        group_constrained: false,
        discoverable: true,
        ...overrides,
    } as Channel;
}

describe('RequestJoinChannelModal', () => {
    test('renders the request flow with display name, purpose and counter', () => {
        const channel = buildChannel({
            display_name: 'Marketing planning',
            purpose: 'Marketing roadmap',
        });

        renderWithContext(
            <RequestJoinChannelModal
                channel={channel}
                memberCount={3}
            />,
        );

        expect(screen.getByText('Request to join Marketing planning')).toBeInTheDocument();
        expect(screen.getByText('Marketing planning')).toBeInTheDocument();
        expect(screen.getByText('Marketing roadmap')).toBeInTheDocument();
        expect(screen.getByText('3 members')).toBeInTheDocument();
        expect(screen.getByText('Send Request')).toBeInTheDocument();
        expect(screen.getByText('0/500 characters')).toBeInTheDocument();
    });

    test('renders the pending flow when the user already has a request', () => {
        const channel = buildChannel();

        const pendingRequest: ChannelJoinRequest = {
            id: 'req1',
            channel_id: 'channel1',
            user_id: 'user1',
            message: '',
            status: 'pending',
            denial_reason: '',
            create_at: 1,
            update_at: 1,
            reviewed_by: '',
            reviewed_at: 0,
        };
        const state = {
            entities: {
                channelJoinRequests: {
                    pendingByMe: {
                        channel1: pendingRequest,
                    },
                    pendingByChannel: {},
                    pendingCounts: {},
                },
            },
        };

        renderWithContext(
            <RequestJoinChannelModal channel={channel}/>,
            state,
        );

        expect(screen.getByText('Withdraw join request')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Withdraw'})).toBeInTheDocument();
        // The character counter should not render in the pending state.
        expect(screen.queryByText('0/500 characters')).not.toBeInTheDocument();
    });
});
