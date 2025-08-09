// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import ChannelSettingsAccessRulesTab from './channel_settings_access_rules_tab';

describe('components/channel_settings_modal/ChannelSettingsAccessRulesTab', () => {
    const baseProps = {
        channel: {
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            type: 'P',
        } as Channel,
        setAreThereUnsavedChanges: jest.fn(),
        showTabSwitchError: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should render access rules title and subtitle', () => {
        const wrapper = shallow(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
        );

        expect(wrapper.find('.ChannelSettingsModal__accessRulesTitle')).toHaveLength(1);
        expect(wrapper.find('.ChannelSettingsModal__accessRulesSubtitle')).toHaveLength(1);
    });
});
