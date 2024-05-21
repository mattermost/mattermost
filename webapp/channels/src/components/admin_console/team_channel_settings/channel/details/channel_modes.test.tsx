// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {ChannelModes} from './channel_modes';

describe('admin_console/team_channel_settings/channel/ChannelModes', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <ChannelModes
                onToggle={jest.fn()}
                isPublic={true}
                isSynced={false}
                isDefault={false}
                isDisabled={false}
                groupsSupported={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot - not licensed for Group', () => {
        const wrapper = shallow(
            <ChannelModes
                onToggle={jest.fn()}
                isPublic={true}
                isSynced={false}
                isDefault={false}
                isDisabled={false}
                groupsSupported={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
