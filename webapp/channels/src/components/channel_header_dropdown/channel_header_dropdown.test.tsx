// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import ChannelHeaderDropdown, {Props} from './channel_header_dropdown_items';

describe('components/ChannelHeaderDropdown', () => {
    const defaultProps = {
        user: TestHelper.getUserMock({id: 'test-user-id'}),
        channel: TestHelper.getChannelMock({id: 'test-channel-id'}),
        isDefault: false,
        isFavorite: false,
        isReadonly: false,
        isMuted: false,
        isArchived: false,
        isMobile: false,
        penultimateViewedChannelName: 'test-channel',
        pluginMenuItems: [],
        isLicensedForLDAPGroups: false,
    };
    test('should match snapshot with no plugin items', () => {
        const wrapper = shallow(<ChannelHeaderDropdown {...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with plugins', () => {
        const props: Props = {
            ...defaultProps,
            pluginMenuItems: [
                {id: 'plugin-1', pluginId: 'playbooks', action: jest.fn(), text: 'plugin-1-text'},
                {id: 'plugin-2', pluginId: 'playbooks', action: jest.fn(), text: 'plugin-2-text'},
            ],
        };
        const wrapper = shallow(<ChannelHeaderDropdown {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
