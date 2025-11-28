// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi, afterEach} from 'vitest';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarChannel from 'components/sidebar/sidebar_channel/sidebar_channel';

import {renderWithContext, cleanup} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/sidebar/sidebar_channel', () => {
    afterEach(() => {
        cleanup();
    });
    const baseProps = {
        channel: {
            id: 'channel_id',
            display_name: 'channel_display_name',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: '',
            type: 'O' as ChannelType,
            name: '',
            header: '',
            purpose: '',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
        },
        channelId: 'channel_id',
        isDraggable: false,
        channelIndex: 0,
        currentTeamName: 'team_name',
        unreadMentions: 0,
        isUnread: false,
        setChannelRef: vi.fn(),
        isCategoryCollapsed: false,
        isCurrentChannel: false,
        isAutoSortedCategory: false,
        isCategoryDragged: false,
        isDropDisabled: false,
        draggingState: {},
        multiSelectedChannelIds: [],
        autoSortedCategoryIds: new Set<string>(),
        isChannelSelected: false,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SidebarChannel {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when collapsed', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when unread', () => {
        const props = {
            ...baseProps,
            isUnread: true,
            unreadMentions: 1,
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when active', () => {
        const props = {
            ...baseProps,
            isCurrentChannel: true,
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when DM channel', () => {
        const currentUser = TestHelper.getUserMock({id: 'current_user_id'});
        const teammate = TestHelper.getUserMock({id: 'teammate_id'});
        const dmChannel = TestHelper.getChannelMock({
            id: 'dm_channel_id',
            type: 'D' as ChannelType,
            name: `${currentUser.id}__${teammate.id}`,
        });

        const props = {
            ...baseProps,
            channel: dmChannel,
            channelId: dmChannel.id,
        };

        const state = {
            entities: {
                users: {
                    currentUserId: currentUser.id,
                    profiles: {
                        [currentUser.id]: currentUser,
                        [teammate.id]: teammate,
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                teams: {
                    currentTeamId: 'team1',
                },
            },
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when GM channel', () => {
        const currentUser = TestHelper.getUserMock({id: 'current_user_id'});
        const gmChannel = TestHelper.getChannelMock({
            id: 'gm_channel_id',
            type: 'G' as ChannelType,
        });

        const props = {
            ...baseProps,
            channel: gmChannel,
            channelId: gmChannel.id,
        };

        const state = {
            entities: {
                users: {
                    currentUserId: currentUser.id,
                    profiles: {
                        [currentUser.id]: currentUser,
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                teams: {
                    currentTeamId: 'team1',
                },
            },
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should not be collapsed when there are unread messages', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
            isUnread: true,
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    test('should not be collapsed if channel is current channel', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
            isCurrentChannel: true,
        };

        const {container} = renderWithContext(
            <SidebarChannel {...props}/>,
        );

        expect(container.querySelector('.expanded')).toBeInTheDocument();
    });
});
