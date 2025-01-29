// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BrowserOrAddChannelMenu from 'components/sidebar/sidebar_header/sidebar_browse_or_add_channel_menu';

import ChannelNavigator from './channel_navigator';
import type {Props} from './channel_navigator';

let props: Props;

describe('Components/ChannelNavigator', () => {
    beforeEach(() => {
        props = {
            showUnreadsCategory: true,
            isQuickSwitcherOpen: false,
            actions: {
                openModal: jest.fn(),
                closeModal: jest.fn(),
            },
        };
    });

    it('should not show BrowserOrAddChannelMenu', () => {
        const wrapper = shallow(<ChannelNavigator {...props}/>);
        expect(wrapper.find(BrowserOrAddChannelMenu).length).toBe(0);
    });
});
