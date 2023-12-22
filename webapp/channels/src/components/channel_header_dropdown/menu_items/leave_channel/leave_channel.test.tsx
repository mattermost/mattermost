// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Menu from 'components/widgets/menu/menu';

import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import LeaveChannel from './leave_channel';

describe('components/ChannelHeaderDropdown/MenuItem.LeaveChannel', () => {
    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            type: 'O',
        }),
        isGuestUser: false,
        isDefault: false,
        actions: {
            leaveChannel: jest.fn(),
            openModal: jest.fn(),
        },
    };

    it('should match snapshot', () => {
        const wrapper = shallow<LeaveChannel>(<LeaveChannel {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should be hidden if the channel is default channel', () => {
        const props = {
            ...baseProps,
            isDefault: true,
        };
        const wrapper = shallow<LeaveChannel>(<LeaveChannel {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should be hidden if the channel type is DM or GM', () => {
        const props = {
            ...baseProps,
            channel: {...baseProps.channel},
        };
        const makeWrapper = () => shallow(<LeaveChannel {...props}/>);

        props.channel.type = 'D';
        expect(makeWrapper()).toMatchSnapshot();

        props.channel.type = 'G';
        expect(makeWrapper()).toMatchSnapshot();
    });

    it('should runs leaveChannel function on click only if the channel is not private', () => {
        const props = {
            ...baseProps,
            channel: {...baseProps.channel},
            actions: {...baseProps.actions},
        };
        const wrapper = shallow<LeaveChannel>(<LeaveChannel {...props}/>);

        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });
        expect(props.actions.leaveChannel).toHaveBeenCalledWith(props.channel.id);
        expect(props.actions.openModal).not.toHaveBeenCalled();

        props.channel.type = 'P';
        props.actions.leaveChannel = jest.fn();
        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });

        expect(props.actions.leaveChannel).not.toHaveBeenCalled();

        expect(props.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
                dialogProps: {
                    channel: props.channel,
                },
            }));
    });
});
