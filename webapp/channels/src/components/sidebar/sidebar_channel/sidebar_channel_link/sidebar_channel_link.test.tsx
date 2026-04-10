// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';
import type {ChannelType} from '@mattermost/types/channels';

import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link/sidebar_channel_link';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext} from 'tests/react_testing_utils';

const isDesktopAppMock = jest.mocked(isDesktopApp);
jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(),
}));
jest.mock('packages/mattermost-redux/src/selectors/entities/shared_channels', () => ({
    getRemoteNamesForChannel: jest.fn(),
}));

jest.mock('packages/mattermost-redux/src/actions/shared_channels', () => ({
    fetchChannelRemotes: jest.fn(() => ({type: 'MOCK_ACTION'})),
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
        fetchChannelRemotes: jest.fn(),
        intl: defaultIntl,
        actions: {
            markMostRecentPostInChannelAsUnread: jest.fn(),
            multiSelectChannel: jest.fn(),
            multiSelectChannelAdd: jest.fn(),
            multiSelectChannelTo: jest.fn(),
            clearChannelSelection: jest.fn(),
            openLhs: jest.fn(),
            unsetEditingPost: jest.fn(),
            closeRightHandSide: jest.fn(),
            fetchChannelRemotes: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SidebarChannelLink {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for desktop', () => {
        isDesktopAppMock.mockImplementation(() => false);

        const {container} = renderWithContext(
            <SidebarChannelLink {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when tooltip is enabled', () => {
        const props = {
            ...baseProps,
            label: 'a'.repeat(200), // Long label to trigger tooltip
        };

        // Mock offsetWidth < scrollWidth to trigger tooltip
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: 50});
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 200});

        const {container} = renderWithContext(
            <SidebarChannelLink {...props}/>,
        );

        expect(container).toMatchSnapshot();

        // Restore
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: 0});
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 0});
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

    test('should enable tooltip when needed', () => {
        // Mock offsetWidth < scrollWidth to trigger tooltip
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: 50});
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 60});

        const {container} = renderWithContext(
            <SidebarChannelLink {...baseProps}/>,
        );

        // When tooltip is enabled, the label should be wrapped in a tooltip component
        const label = container.querySelector('.SidebarChannelLinkLabel');
        expect(label).toBeInTheDocument();

        // Restore
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: 0});
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 0});
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
        expect(props.actions.fetchChannelRemotes).not.toHaveBeenCalled();
    });

    test('should refetch when channel changes', () => {
        const props = {
            ...baseProps,
            isSharedChannel: true,
            remoteNames: [],
        };

        const {rerender} = renderWithContext(
            <SidebarChannelLink {...props}/>,
        );

        props.actions.fetchChannelRemotes.mockClear();

        rerender(
            <SidebarChannelLink
                {...props}
                channel={{
                    ...props.channel,
                    id: 'new_channel_id',
                }}
            />,
        );

        expect(props.actions.fetchChannelRemotes).toHaveBeenCalledWith('new_channel_id');
    });
});
