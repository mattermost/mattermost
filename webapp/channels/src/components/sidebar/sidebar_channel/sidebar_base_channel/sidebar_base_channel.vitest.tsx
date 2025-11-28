// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarBaseChannel from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel';

import {renderWithContext, userEvent, cleanup, screen, waitFor} from 'tests/vitest_react_testing_utils';

describe('components/sidebar/sidebar_channel/sidebar_base_channel', () => {
    beforeEach(() => {
        vi.useFakeTimers({shouldAdvanceTime: true});
    });

    afterEach(() => {
        vi.useRealTimers();
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
        currentTeamName: 'team_name',
        actions: {
            leaveChannel: vi.fn(),
            openModal: vi.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SidebarBaseChannel {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when shared channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                shared: true,
            },
        };

        const {container} = renderWithContext(
            <SidebarBaseChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when private channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
            },
        };

        const {container} = renderWithContext(
            <SidebarBaseChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when shared private channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
                shared: true,
            },
        };

        const {container} = renderWithContext(
            <SidebarBaseChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('expect leaveChannel to be called when leave public channel ', async () => {
        const mockfn = vi.fn();

        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'O' as ChannelType,
                shared: true,
                name: 'l',
            },
            actions: {
                leaveChannel: mockfn,
                openModal: vi.fn(),
            },
        };

        renderWithContext(<SidebarBaseChannel {...props}/>);

        const optionsBtn = screen.getByRole('button');
        expect(optionsBtn.classList).toContain('SidebarMenu_menuButton');

        await userEvent.click(optionsBtn); // open options
        const leaveOption: HTMLElement = screen.getByText('Leave Channel').parentElement!;

        await userEvent.click(leaveOption);
        await waitFor(() => {
            expect(mockfn).toHaveBeenCalledTimes(1);
        });
    });

    test('expect openModal to be called when leave private channel ', async () => {
        const mockfn = vi.fn();

        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
                name: 'l',
            },
            actions: {
                leaveChannel: vi.fn(),
                openModal: mockfn,
            },
        };

        renderWithContext(<SidebarBaseChannel {...props}/>);

        const optionsBtn = screen.getByRole('button');
        expect(optionsBtn.classList).toContain('SidebarMenu_menuButton');

        await userEvent.click(optionsBtn); // open options
        const leaveOption: HTMLElement = screen.getByText('Leave Channel').parentElement!;

        await userEvent.click(leaveOption);
        await waitFor(() => {
            expect(mockfn).toHaveBeenCalledTimes(1);
        });
    });
});
