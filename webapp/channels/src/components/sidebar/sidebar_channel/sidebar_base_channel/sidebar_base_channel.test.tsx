// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarBaseChannel from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel';
import { fireEvent, screen } from '@testing-library/react';

import { renderWithContext, userEvent } from 'tests/react_testing_utils';


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

    test('expect callback to be called when leave public channel ', async () => {
        const mockfn = jest.fn();
        
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'O' as ChannelType,
                shared: true,
                name: 'l'
            },
            actions: {
                leaveChannel: mockfn,
                openModal: mockfn
            }
        };
        // const sprops:any = {...props,ns};

        renderWithContext(<SidebarBaseChannel {...props}/>);

        const optionsBtn = screen.getByRole('button');
        expect(optionsBtn.classList).toContain('SidebarMenu_menuButton');

        await userEvent.click(optionsBtn) // open options
        const leaveOption:any = screen.getByText('Leave Channel').parentElement;
        screen.debug(leaveOption)
        
        await userEvent.click(leaveOption);
        expect(mockfn).toHaveBeenCalledTimes(1);
    });

    // test('expect callback to be called when leave private channel ', async () => {
    //     const actions = {
    //         leaveChannel: jest.fn(),
    //     };
    //     const props:any = {...baseProps, actions};

    //     const optionsBtn = screen.getByRole('button')
    //     expect(optionsBtn.classList).toContain('SidebarMenu_menuButton');
    //     await userEvent.click(optionsBtn)
    //     const leaveOption:any = screen.getByText('Leave Channel').parentElement
    //     screen.debug(undefined, 80000)
         
    //     await userEvent.click(leaveOption);
    //     expect(actions.leaveChannel).toHaveBeenCalledTimes(1);
    // });
});