// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link/sidebar_channel_link';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

vi.mock('packages/mattermost-redux/src/selectors/entities/shared_channels', () => ({
    getRemoteNamesForChannel: vi.fn(),
}));

vi.mock('packages/mattermost-redux/src/actions/shared_channels', () => ({
    fetchChannelRemotes: vi.fn(() => ({type: 'MOCK_ACTION'})),
}));

describe('components/sidebar/sidebar_channel/sidebar_channel_link', () => {
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
        link: 'http://a.fake.link',
        label: 'channel_label',
        icon: null,
        unreadMentions: 0,
        isUnread: false,
        isMuted: false,
        isChannelSelected: false,
        hasUrgent: false,
        showChannelsTutorialStep: false,
        remoteNames: [],
        isSharedChannel: false,
        fetchChannelRemotes: vi.fn(),
        actions: {
            markMostRecentPostInChannelAsUnread: vi.fn(),
            multiSelectChannel: vi.fn(),
            multiSelectChannelAdd: vi.fn(),
            multiSelectChannelTo: vi.fn(),
            clearChannelSelection: vi.fn(),
            openLhs: vi.fn(),
            unsetEditingPost: vi.fn(),
            closeRightHandSide: vi.fn(),
            fetchChannelRemotes: vi.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SidebarChannelLink {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with aria label prefix and unread mentions', () => {
        const props = {
            ...baseProps,
            isUnread: true,
            unreadMentions: 2,
            ariaLabelPrefix: 'aria_label_prefix_',
        };

        const {container} = renderWithContext(
            <SidebarChannelLink {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should not fetch shared channels for non-shared channels', () => {
        const props = {
            ...baseProps,
            isSharedChannel: false,
        };

        const {container} = renderWithContext(
            <SidebarChannelLink {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(props.actions.fetchChannelRemotes).not.toHaveBeenCalled();
    });

    test('should fetch shared channels data when channel is shared', () => {
        const props = {
            ...baseProps,
            isSharedChannel: true,
            remoteNames: [],
        };

        const {container} = renderWithContext(
            <SidebarChannelLink {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(props.actions.fetchChannelRemotes).toHaveBeenCalledWith('channel_id');
    });

    test('should not fetch shared channels data when data already exists', () => {
        const props = {
            ...baseProps,
            isSharedChannel: true,
            remoteNames: ['Remote 1', 'Remote 2'],
        };

        const {container} = renderWithContext(
            <SidebarChannelLink {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
