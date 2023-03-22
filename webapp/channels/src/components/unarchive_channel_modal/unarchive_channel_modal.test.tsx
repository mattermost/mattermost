// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {Modal} from 'react-bootstrap';

import {TestHelper} from 'utils/test_helper';

import UnarchiveChannelModal from './unarchive_channel_modal';

describe('components/unarchive_channel_modal', () => {
    const channel = TestHelper.getChannelMock({
        create_at: 1508265709607,
        creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        delete_at: 0,
        display_name: 'testing',
        header: 'test',
        id: 'owsyt8n43jfxjpzh9np93mx1wa',
        last_post_at: 1508265709635,
        name: 'testing',
        purpose: 'test',
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        type: 'O',
        update_at: 1508265709607,
    });

    const currentTeamDetails = {
        name: 'mattermostDev',
    };

    const baseProps = {
        channel,
        currentTeamDetails,
        actions: {
            unarchiveChannel: jest.fn(),
        },
        onExited: jest.fn(),
        penultimateViewedChannelName: 'my-prev-channel',
    };

    test('should match snapshot for unarchive_channel_modal', () => {
        const wrapper = shallow(
            <UnarchiveChannelModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match state when onHide is called', () => {
        const wrapper = shallow<UnarchiveChannelModal>(
            <UnarchiveChannelModal {...baseProps}/>,
        );

        wrapper.setState({show: true});
        wrapper.instance().onHide();
        expect(wrapper.state('show')).toEqual(false);
    });

    test('should have called actions.unarchiveChannel when handleUnarchive is called', () => {
        const actions = {unarchiveChannel: jest.fn()};
        const props = {...baseProps, actions};
        const wrapper = shallow<UnarchiveChannelModal>(
            <UnarchiveChannelModal {...props}/>,
        );

        wrapper.setState({show: true});
        wrapper.instance().handleUnarchive();

        expect(actions.unarchiveChannel).toHaveBeenCalledTimes(1);
        expect(actions.unarchiveChannel).toHaveBeenCalledWith(props.channel.id);
    });

    test('should have called props.onHide when Modal.onExited is called', () => {
        const wrapper = shallow(
            <UnarchiveChannelModal {...baseProps}/>,
        );

        wrapper.find(Modal).props().onExited!(document.createElement('div'));
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });
});
