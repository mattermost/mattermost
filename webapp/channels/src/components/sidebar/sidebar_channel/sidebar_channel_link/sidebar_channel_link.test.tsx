// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';
import type {ChannelType} from '@mattermost/types/channels';

import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link/sidebar_channel_link';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

const isDesktopAppMock = jest.mocked(isDesktopApp);
jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(),
}));

describe('components/sidebar/sidebar_channel/sidebar_channel_link', () => {
    const baseChannel = {
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
    };

    const baseProps = {
        channel: baseChannel,
        link: '/team/channels/town-square',
        label: 'channel_label',
        icon: null,
        unreadMentions: 0,
        isUnread: false,
        isMuted: false,
        isChannelSelected: false,
        hasUrgent: false,
        showChannelsTutorialStep: false,
        remoteNames: [] as string[],
        isSharedChannel: false,
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

    const renderLink = (props: Partial<typeof baseProps> = {}) => {
        const merged = mergeObjects(baseProps, props);
        return renderWithContext(<SidebarChannelLink {...merged}/>);
    };

    test('should match snapshot', () => {
        const {container} = renderLink();

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for desktop', () => {
        isDesktopAppMock.mockImplementation(() => false);

        const {container} = renderLink();

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when tooltip is enabled', () => {
        const props = {
            label: 'a'.repeat(200),
        };

        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: 50});
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 200});

        const {container} = renderLink(props);

        expect(container).toMatchSnapshot();

        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: 0});
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 0});
    });

    test('should match snapshot with aria label prefix and unread mentions', () => {
        const props = {
            isUnread: true,
            unreadMentions: 2,
            ariaLabelPrefix: 'aria_label_prefix_',
        };

        const {container} = renderLink(props);

        expect(container).toMatchSnapshot();
    });

    test('should enable tooltip when needed', () => {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: 50});
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 60});

        const {container} = renderLink();

        const label = container.querySelector('.SidebarChannelLinkLabel');
        expect(label).toBeInTheDocument();

        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {configurable: true, value: 0});
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 0});
    });

    test('should not fetch shared channels for non-shared channels', () => {
        const props = {
            isSharedChannel: false,
        };

        const {container} = renderLink(props);

        expect(container).toMatchSnapshot();
        expect(baseProps.actions.fetchChannelRemotes).not.toHaveBeenCalled();
    });

    test('should fetch shared channels data when channel is shared', () => {
        const props = {
            isSharedChannel: true,
            remoteNames: [],
        };

        const {container} = renderLink(props);

        expect(container).toMatchSnapshot();
        expect(baseProps.actions.fetchChannelRemotes).toHaveBeenCalledWith('channel_id');
    });

    test('should not fetch shared channels data when data already exists', () => {
        const props = {
            isSharedChannel: true,
            remoteNames: ['Remote 1', 'Remote 2'],
        };

        const {container} = renderLink(props);

        expect(container).toMatchSnapshot();
        expect(baseProps.actions.fetchChannelRemotes).not.toHaveBeenCalled();
    });

    test('should pass urgent tooltip to ChannelMentionBadge when hasUrgent is true', async () => {
        jest.useFakeTimers();

        renderLink({
            unreadMentions: 3,
            hasUrgent: true,
        });

        const badge = screen.getByText('3').closest('.badge')!;
        expect(badge).toHaveClass('urgent');

        await userEvent.hover(badge, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('You have an urgent mention')).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('should not show urgent mention tooltip when hasUrgent is false', async () => {
        jest.useFakeTimers();

        renderLink({
            unreadMentions: 3,
            hasUrgent: false,
        });

        const badge = screen.getByText('3').closest('.badge')!;
        expect(badge).not.toHaveClass('urgent');

        await userEvent.hover(badge, {advanceTimers: jest.advanceTimersByTime});

        expect(screen.queryByText('You have an urgent mention')).not.toBeInTheDocument();

        jest.useRealTimers();
    });

    test('should include urgent mention in link accessible name when hasUrgent', () => {
        renderLink({
            unreadMentions: 2,
            hasUrgent: true,
        });

        expect(screen.getByRole('link')).toHaveAccessibleName(/including an urgent mention/i);
    });

    test('should not include urgent mention in link accessible name when not hasUrgent', () => {
        renderLink({
            unreadMentions: 2,
            hasUrgent: false,
        });

        expect(screen.getByRole('link')).not.toHaveAccessibleName(/including an urgent mention/i);
    });

    test('should refetch when channel changes', () => {
        const props = {
            isSharedChannel: true,
            remoteNames: [],
        };

        const {rerender} = renderLink(props);

        rerender(
            <SidebarChannelLink
                {...mergeObjects(mergeObjects(baseProps, props), {
                    channel: mergeObjects(baseProps.channel, {id: 'new_channel_id'}),
                })}
            />,
        );

        expect(baseProps.actions.fetchChannelRemotes).toHaveBeenCalledWith('new_channel_id');
    });
});
