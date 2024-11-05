// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarBaseChannel from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

describe('components/sidebar/sidebar_channel/sidebar_base_channel', () => {
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
            leaveChannel: jest.fn(),
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SidebarBaseChannel {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when shared channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                shared: true,
            },
        };

        const wrapper = shallow(
            <SidebarBaseChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when private channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
            },
        };

        const wrapper = shallow(
            <SidebarBaseChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
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

        const wrapper = shallow(
            <SidebarBaseChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('expect leaveChannel to be called when leave public channel ', async () => {
        const mockfn = jest.fn();

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
                openModal: jest.fn(),
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
        const mockfn = jest.fn();

        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
                name: 'l',
            },
            actions: {
                leaveChannel: jest.fn(),
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
