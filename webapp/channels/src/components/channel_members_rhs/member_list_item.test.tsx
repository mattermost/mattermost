// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {ChannelMember} from './member_list';
import {ListItemType} from './member_list';
import type {ItemData} from './member_list_item';
import MemberListItem from './member_list_item';

jest.mock('./member', () => {
    return (props: any) => (
        <div data-testid={`mock-member-${props.member.user.id}`}>
            {props.member.displayName}
        </div>
    );
});

describe('components/channel_members_rhs/MemberListItem', () => {
    const mockChannel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Test Channel',
        name: 'test-channel',
        type: 'O' as ChannelType,
        team_id: 'team_id',
    });

    const mockUser = TestHelper.getUserMock({
        id: 'user_id_1',
        username: 'testuser',
        nickname: 'Test User',
        roles: 'system_user',
    });

    const mockMembership = TestHelper.getChannelMembershipMock({
        channel_id: 'channel_id',
        user_id: 'user_id_1',
    });

    const mockMember: ChannelMember = {
        user: mockUser,
        membership: mockMembership,
        status: 'online',
        displayName: 'Test User',
    };

    const baseItemData: ItemData = {
        members: [
            {type: ListItemType.Member, data: mockMember},
        ],
        hasNextPage: false,
        channel: mockChannel,
        editing: false,
        totalMemberCount: 1,
        openDirectMessage: jest.fn(),
        fetchRemoteClusterInfo: jest.fn(),
    };

    const baseStyle = {top: 0, left: 0, width: '100%', height: 48, position: 'absolute' as const};

    test('should render a Member component for a member item', () => {
        const separatorData: ItemData = {
            ...baseItemData,
            members: [
                {type: ListItemType.Separator, data: <span>{'Separator Label'}</span>},
            ],
        };

        renderWithContext(
            <MemberListItem
                index={0}
                style={baseStyle}
                data={separatorData}
                isScrolling={false}
            />,
        );

        expect(screen.getByText('Separator Label')).toBeVisible();
    });

    test('should render multiple members at different indices', () => {
        const secondUser = TestHelper.getUserMock({
            id: 'user_id_2',
            username: 'seconduser',
            nickname: 'Second User',
        });

        const secondMember: ChannelMember = {
            ...mockMember,
            user: secondUser,
            displayName: 'Second User',
        };

        const multiMemberData: ItemData = {
            ...baseItemData,
            members: [
                {type: ListItemType.Member, data: mockMember},
                {type: ListItemType.Member, data: secondMember},
            ],
            totalMemberCount: 2,
        };

        const {rerender} = renderWithContext(
            <MemberListItem
                index={0}
                style={baseStyle}
                data={multiMemberData}
                isScrolling={false}
            />,
        );

        expect(screen.getByText('Test User')).toBeVisible();

        rerender(
            <MemberListItem
                index={1}
                style={baseStyle}
                data={multiMemberData}
                isScrolling={false}
            />,
        );

        expect(screen.getByText('Second User')).toBeVisible();
    });
});
