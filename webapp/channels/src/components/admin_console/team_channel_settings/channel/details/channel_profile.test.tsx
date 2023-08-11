// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import {ChannelProfile} from './channel_profile';

describe('admin_console/team_channel_settings/channel/ChannelProfile', () => {
    test('should match snapshot', () => {
        const testTeam: Partial<Team> = {display_name: 'test'};
        const testChannel: Partial<Channel> = {display_name: 'test'};
        const wrapper = shallow(
            <ChannelProfile
                isArchived={false}
                team={testTeam}
                channel={testChannel}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for a shared channel', () => {
        const testTeam: Partial<Team> = {display_name: 'test'};
        const testChannel: Partial<Channel> = {
            display_name: 'test',
            type: 'O',
            shared: true,
        };
        const wrapper = shallow(
            <ChannelProfile
                isArchived={false}
                team={testTeam}
                channel={testChannel}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
