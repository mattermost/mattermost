// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Modal} from 'react-bootstrap';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import DeleteChannelModal from 'components/delete_channel_modal/delete_channel_modal';
import type {Props} from 'components/delete_channel_modal/delete_channel_modal';

import {getHistory} from 'utils/browser_history';

describe('components/delete_channel_modal', () => {
    const channel: Channel = {
        id: 'owsyt8n43jfxjpzh9np93mx1wa',
        create_at: 1508265709607,
        update_at: 1508265709607,
        delete_at: 0,
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        type: 'O' as ChannelType,
        display_name: 'testing',
        name: 'testing',
        header: 'test',
        purpose: 'test',
        last_post_at: 1508265709635,
        last_root_post_at: 1508265709635,
        creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        scheme_id: '',
        group_constrained: false,
    };

    const currentTeamDetails = {
        name: 'mattermostDev',
    };

    const baseProps: Props = {
        channel,
        currentTeamDetails,
        actions: {
            deleteChannel: jest.fn(() => {
                return {data: true};
            }),
        },
        onExited: jest.fn(),
        penultimateViewedChannelName: 'my-prev-channel',
    };

    test('should match snapshot for delete_channel_modal', () => {
        const wrapper = shallow(
            <DeleteChannelModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match state when onHide is called', () => {
        const wrapper = shallow<DeleteChannelModal>(
            <DeleteChannelModal {...baseProps}/>,
        );

        wrapper.setState({show: true});
        wrapper.instance().onHide();
        expect(wrapper.state('show')).toEqual(false);
    });

    test('should have called actions.deleteChannel when handleDelete is called', () => {
        const actions = {deleteChannel: jest.fn()};
        const props = {...baseProps, actions};
        const wrapper = shallow<DeleteChannelModal>(
            <DeleteChannelModal {...props}/>,
        );

        wrapper.setState({show: true});
        wrapper.instance().handleDelete();

        expect(actions.deleteChannel).toHaveBeenCalledTimes(1);
        expect(actions.deleteChannel).toHaveBeenCalledWith(props.channel.id);
        expect(getHistory().push).toHaveBeenCalledWith('/mattermostDev/channels/my-prev-channel');
        expect(wrapper.state('show')).toEqual(false);
    });

    test('should have called props.onExited when Modal.onExited is called', () => {
        const wrapper = shallow(
            <DeleteChannelModal {...baseProps}/>,
        );

        wrapper.find(Modal).props().onExited!(document.createElement('div'));
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });
});
