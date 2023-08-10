// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    act,
    fireEvent,
    renderWithIntl,
    screen,
} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import Menu from './menu';

import type {Channel, ChannelStats} from '@mattermost/types/channels';

describe('channel_info_rhs/menu', () => {
    const defaultProps = {
        channel: {type: Constants.OPEN_CHANNEL} as Channel,
        channelStats: {files_count: 3, pinnedpost_count: 12, member_count: 32} as ChannelStats,
        isArchived: false,
        actions: {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {files_count: 3, pinnedpost_count: 12, member_count: 32}})),
        },
    };

    beforeEach(() => {
        defaultProps.actions = {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {files_count: 3, pinnedpost_count: 12, member_count: 32}})),
        };
    });

    test('should display notifications preferences', async () => {
        const props = {...defaultProps};
        props.actions.openNotificationSettings = jest.fn();

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Notification Preferences'));

        expect(props.actions.openNotificationSettings).toHaveBeenCalled();
    });

    test('should NOT display notifications preferences in a DM', async () => {
        const props = {
            ...defaultProps,
            channel: {type: Constants.DM_CHANNEL} as Channel,
        };

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(screen.queryByText('Notification Preferences')).not.toBeInTheDocument();
    });

    test('should NOT display notifications preferences in an archived channel', async () => {
        const props = {
            ...defaultProps,
            isArchived: true,
        };

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(screen.queryByText('Notification Preferences')).not.toBeInTheDocument();
    });

    test('should display the number of files', async () => {
        const props = {...defaultProps};
        props.actions.showChannelFiles = jest.fn();

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const fileItem = screen.getByText('Files');
        expect(fileItem).toBeInTheDocument();
        expect(fileItem.parentElement).toHaveTextContent('3');

        fireEvent.click(fileItem);
        expect(props.actions.showChannelFiles).toHaveBeenCalled();
    });

    test('should display the pinned messages', async () => {
        const props = {...defaultProps};
        props.actions.showPinnedPosts = jest.fn();

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const fileItem = screen.getByText('Pinned Messages');
        expect(fileItem).toBeInTheDocument();
        expect(fileItem.parentElement).toHaveTextContent('12');

        fireEvent.click(fileItem);
        expect(props.actions.showPinnedPosts).toHaveBeenCalled();
    });

    test('should display members', async () => {
        const props = {...defaultProps};
        props.actions.showChannelMembers = jest.fn();

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const membersItem = screen.getByText('Members');
        expect(membersItem).toBeInTheDocument();
        expect(membersItem.parentElement).toHaveTextContent('32');

        fireEvent.click(membersItem);
        expect(props.actions.showChannelMembers).toHaveBeenCalled();
    });

    test('should NOT display members in DM', async () => {
        const props = {
            ...defaultProps,
            channel: {type: Constants.DM_CHANNEL} as Channel,
        };

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        const membersItem = screen.queryByText('Members');
        expect(membersItem).not.toBeInTheDocument();
    });
});
