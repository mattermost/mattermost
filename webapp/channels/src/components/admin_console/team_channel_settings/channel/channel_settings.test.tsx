// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {ChannelsSettings} from './channel_settings';

describe('admin_console/team_channel_settings/channel/ChannelSettings', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <ChannelsSettings
                siteName='site'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
