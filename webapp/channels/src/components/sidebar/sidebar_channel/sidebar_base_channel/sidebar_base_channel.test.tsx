// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarBaseChannel from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

jest.mock('components/tours/onboarding_tour', () => ({
    ChannelsAndDirectMessagesTour: () => null,
}));

jest.mock('components/sidebar/sidebar_channel/sidebar_channel_link', () => {
    const React = require('react');

    return ({label, channelLeaveHandler}: {label: string; channelLeaveHandler?: (callback: () => void) => void}) => {
        const [isOpen, setIsOpen] = React.useState(false);

        return (
            <div>
                <button
                    aria-label='Channel options'
                    onClick={() => setIsOpen(true)}
                >
                    {'Options'}
                </button>
                {isOpen && (
                    <div
                        role='menu'
                        aria-label='Edit channel menu'
                    >
                        <button
                            role='menuitem'
                            onClick={() => channelLeaveHandler?.(() => {})}
                        >
                            {'Leave Channel'}
                        </button>
                    </div>
                )}
                <div>{label}</div>
            </div>
        );
    };
});

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
        const user = userEvent.setup();

        const optionsBtn = screen.getByRole('button', {name: /channel options/i});

        await user.click(optionsBtn); // open options
        await user.click(screen.getByRole('menuitem', {name: 'Leave Channel'}));
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
        const user = userEvent.setup();

        const optionsBtn = screen.getByRole('button', {name: /channel options/i});

        await user.click(optionsBtn); // open options
        await user.click(screen.getByRole('menuitem', {name: 'Leave Channel'}));
        await waitFor(() => {
            expect(mockfn).toHaveBeenCalledTimes(1);
        });
    });
});
