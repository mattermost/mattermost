// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {TeamType} from '@mattermost/types/teams';

import Menu from 'components/widgets/menu/menu';

import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import CloseMessage from './close_message';

describe('components/ChannelHeaderDropdown/MenuItem.CloseMessage', () => {
    const baseProps = {
        currentUser: TestHelper.getUserMock(),
        redirectChannel: 'test-default-channel',
        currentTeam: TestHelper.getTeamMock({
            id: 'team_id',
            name: 'test-team',
            display_name: 'Test team display name',
            description: 'Test team description',
            type: 'team-type' as TeamType,
        }),
        actions: {
            savePreferences: jest.fn(() => Promise.resolve()),
            leaveDirectChannel: jest.fn(() => Promise.resolve()),
        },
    };

    const groupChannel = TestHelper.getChannelMock({
        id: 'channel_id',
        type: Constants.GM_CHANNEL as ChannelType,
    });

    const directChannel = TestHelper.getChannelMock({
        id: 'channel_id',
        type: Constants.DM_CHANNEL as ChannelType,
        teammate_id: 'teammate-id',
    });

    it('should match snapshot for DM Channel', () => {
        const props = {...baseProps, channel: directChannel};
        const wrapper = shallow(<CloseMessage {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot for GM Channel', () => {
        const props = {...baseProps, channel: groupChannel};
        const wrapper = shallow(<CloseMessage {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should run savePreferences function on click for DM', () => {
        const props = {...baseProps, channel: directChannel};
        const wrapper = shallow(<CloseMessage {...props}/>);
        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });
        expect(props.actions.savePreferences).toBeCalledWith(props.currentUser.id, [{user_id: props.currentUser.id, category: Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: props.channel.teammate_id, value: 'false'}]);
    });

    it('should run savePreferences function on click for GM', () => {
        const props = {...baseProps, channel: groupChannel};
        const wrapper = shallow(<CloseMessage {...props}/>);
        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });
        expect(props.actions.savePreferences).toBeCalledWith(props.currentUser.id, [{user_id: props.currentUser.id, category: Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW, name: props.channel.id, value: 'false'}]);
    });
});
