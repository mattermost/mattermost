// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import * as channelActions from 'mattermost-redux/actions/channels';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {NotificationLevels} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ToggleMuteChannel from './toggle_mute_channel';

describe('components/ChannelHeaderMenu/MenuItems/ToggleMuteChannel', () => {
    const channel = TestHelper.getChannelMock();
    const user = TestHelper.getUserMock();

    beforeEach(() => {
        jest.spyOn(channelActions, 'updateChannelNotifyProps').mockReturnValue(() => Promise.resolve({data: true}));
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly, public channel, not muted', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ToggleMuteChannel
                    channel={channel}
                    userID={user.id}
                    isMuted={false}
                />
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Mute Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(channelActions.updateChannelNotifyProps).toHaveBeenCalledTimes(1);
        expect(channelActions.updateChannelNotifyProps).toHaveBeenCalledWith(
            user.id,
            channel.id,
            {mark_unread: NotificationLevels.MENTION},
        );
    });

    test('renders the component correctly, public channel, muted', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ToggleMuteChannel
                    channel={channel}
                    userID={user.id}
                    isMuted={true}
                />
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Unmute Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(channelActions.updateChannelNotifyProps).toHaveBeenCalledTimes(1);
        expect(channelActions.updateChannelNotifyProps).toHaveBeenCalledWith(
            user.id,
            channel.id,
            {mark_unread: NotificationLevels.ALL},
        );
    });

    test('renders the component correctly, dm channel, not muted', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        renderWithContext(
            <WithTestMenuContext>
                <ToggleMuteChannel
                    channel={channel}
                    userID={user.id}
                    isMuted={false}
                />
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Mute');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(channelActions.updateChannelNotifyProps).toHaveBeenCalledTimes(1);
        expect(channelActions.updateChannelNotifyProps).toHaveBeenCalledWith(
            user.id,
            channel.id,
            {mark_unread: NotificationLevels.MENTION},
        );
    });
    test('renders the component correctly, dm channel, muted', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        renderWithContext(
            <WithTestMenuContext>
                <ToggleMuteChannel
                    channel={channel}
                    userID={user.id}
                    isMuted={true}
                />
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Unmute');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(channelActions.updateChannelNotifyProps).toHaveBeenCalledTimes(1);
        expect(channelActions.updateChannelNotifyProps).toHaveBeenCalledWith(
            user.id,
            channel.id,
            {mark_unread: NotificationLevels.ALL},
        );
    });
});
