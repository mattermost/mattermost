// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';

import {Channel, ChannelStats} from '@mattermost/types/channels';
import {renderWithIntl} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import Menu from './menu';

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
        },
    };

    beforeEach(() => {
        defaultProps.actions = {
            openNotificationSettings: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
        };
    });

    test('should display notifications preferences', () => {
        const props = {...defaultProps};
        props.actions.openNotificationSettings = jest.fn();

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Notification Preferences'));

        expect(props.actions.openNotificationSettings).toHaveBeenCalled();
    });

    test('should NOT display notifications preferences in a DM', () => {
        const props = {
            ...defaultProps,
            channel: {type: Constants.DM_CHANNEL} as Channel,
        };

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        expect(screen.queryByText('Notification Preferences')).not.toBeInTheDocument();
    });

    test('should NOT display notifications preferences in an archived channel', () => {
        const props = {
            ...defaultProps,
            isArchived: true,
        };

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        expect(screen.queryByText('Notification Preferences')).not.toBeInTheDocument();
    });

    test('should display the number of files', () => {
        const props = {...defaultProps};
        props.actions.showChannelFiles = jest.fn();

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        const fileItem = screen.getByText('Files');
        expect(fileItem).toBeInTheDocument();
        expect(fileItem.parentElement).toHaveTextContent('3');

        fireEvent.click(fileItem);
        expect(props.actions.showChannelFiles).toHaveBeenCalled();
    });

    test('should display the pinned messages', () => {
        const props = {...defaultProps};
        props.actions.showPinnedPosts = jest.fn();

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        const fileItem = screen.getByText('Pinned Messages');
        expect(fileItem).toBeInTheDocument();
        expect(fileItem.parentElement).toHaveTextContent('12');

        fireEvent.click(fileItem);
        expect(props.actions.showPinnedPosts).toHaveBeenCalled();
    });

    test('should display members', () => {
        const props = {...defaultProps};
        props.actions.showChannelMembers = jest.fn();

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        const membersItem = screen.getByText('Members');
        expect(membersItem).toBeInTheDocument();
        expect(membersItem.parentElement).toHaveTextContent('32');

        fireEvent.click(membersItem);
        expect(props.actions.showChannelMembers).toHaveBeenCalled();
    });

    test('should NOT display members in DM', () => {
        const props = {
            ...defaultProps,
            channel: {type: Constants.DM_CHANNEL} as Channel,
        };

        renderWithIntl(
            <Menu
                {...props}
            />,
        );

        const membersItem = screen.queryByText('Members');
        expect(membersItem).not.toBeInTheDocument();
    });
});
