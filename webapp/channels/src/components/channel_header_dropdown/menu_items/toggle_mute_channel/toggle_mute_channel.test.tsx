// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import Menu from 'components/widgets/menu/menu';
import MenuItemAction from 'components/widgets/menu/menu_items/menu_item_action';

import {Constants, NotificationLevels} from 'utils/constants';

import MenuItemToggleMuteChannel from './toggle_mute_channel';

describe('components/ChannelHeaderDropdown/MenuItemToggleMuteChannel', () => {
    const baseProps = {
        user: {
            id: 'user_id',
        } as UserProfile,
        channel: {
            id: 'channel_id',
            type: 'O',
        } as Channel,
        isMuted: false,
        actions: {
            updateChannelNotifyProps: jest.fn(),
        },
    };

    it('should match snapshot', () => {
        const wrapper = shallow(<MenuItemToggleMuteChannel {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should unmute channel on click the channel was muted', () => {
        const props = {
            ...baseProps,
            isMuted: true,
            actions: {
                updateChannelNotifyProps: jest.fn(),
            },
        };
        const wrapper = shallow(<MenuItemToggleMuteChannel {...props}/>);

        wrapper.find(Menu.ItemAction).simulate('click');

        expect(props.actions.updateChannelNotifyProps).toBeCalledWith(
            props.user.id,
            props.channel.id,
            {mark_unread: NotificationLevels.ALL},
        );
    });

    it('should mute channel on click the channel was unmuted', () => {
        const props = {
            ...baseProps,
            isMuted: false,
            actions: {
                updateChannelNotifyProps: jest.fn(),
            },
        };
        const wrapper = shallow(<MenuItemToggleMuteChannel {...props}/>);

        wrapper.find(Menu.ItemAction).simulate('click');

        expect(props.actions.updateChannelNotifyProps).toBeCalledWith(
            props.user.id,
            props.channel.id,
            {mark_unread: NotificationLevels.MENTION},
        );
    });

    it('should show Mute Channel to all channel types except DM_CHANNEL and GM_CHANNEL', () => {
        [
            Constants.OPEN_CHANNEL,
            Constants.PRIVATE_CHANNEL,
            Constants.ARCHIVED_CHANNEL,
        ].forEach((channelType) => {
            const channel = {
                id: 'channel_id',
                type: channelType,
            } as Channel;

            const wrapper = shallow(
                <MenuItemToggleMuteChannel
                    {...baseProps}
                    channel={channel}
                />,
            );
            expect(wrapper.find(MenuItemAction).props().show).toEqual(true);
            expect(wrapper.find(MenuItemAction).props().text).toEqual('Mute Channel');
        });
    });
    it('should show Mute Conversation to  channel types DM_CHANNEL and GM_CHANNEL', () => {
        [
            Constants.DM_CHANNEL,
            Constants.GM_CHANNEL,
        ].forEach((channelType) => {
            const channel = {
                id: 'channel_id',
                type: channelType,
            } as Channel;

            const wrapper = shallow(
                <MenuItemToggleMuteChannel
                    {...baseProps}
                    channel={channel}
                />,
            );
            expect(wrapper.find(MenuItemAction).props().show).toEqual(true);
            expect(wrapper.find(MenuItemAction).props().text).toEqual('Mute Conversation');
        });
    });
});
